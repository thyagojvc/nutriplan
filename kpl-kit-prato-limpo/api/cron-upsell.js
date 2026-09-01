// GET /api/cron-upsell  (disparado pelo cron da Vercel, ver vercel.json)
//
// Manda o e-mail de upgrade pra quem comprou o ESSENCIAL há alguns dias.
// O timing é o ponto: no dia da compra ela ainda não sabe se o material presta,
// e oferecer mais na hora parece enrolação. Depois de uns dias ela já aplicou
// algumas fichas e viu que funciona, que é quando a objeção de confiança cai.
//
// POR QUE UM ZSET E NÃO UMA VARREDURA: `api/_entrega.js` empurra o token pra
// `upsell:fila` com a data como score. Aqui só se lê a faixa que já venceu.
// Varrer `dl:*` todo dia seria caro e a cota do Redis desta conta já estourou
// uma vez (ver o caso da troca de banco em 17/08).
//
// Segurança: o cron da Vercel manda `Authorization: Bearer $CRON_SECRET`. Sem
// o segredo configurado o endpoint se recusa a rodar, em vez de ficar aberto.

const { redis } = require('./_kv');
const { sendEmail } = require('./_resend');

const DIAS = 3;                 // espera antes de oferecer
const LOTE = 25;                // teto por execução, pra não estourar cota nem Resend
const BASE = (process.env.PUBLIC_BASE_URL || 'https://kitpratolimpo.com.br').replace(/\/+$/, '');

function emailHtml({ nome, url }) {
  const primeiro = String(nome || '').trim().split(/\s+/)[0];
  return `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #26302A;">
    <p>${primeiro ? primeiro + ', t' : 'T'}udo bem? Passei pra saber como está indo com o Kit Prato Limpo aí em casa.</p>

    <p>Se as fichas já entraram na rotina de vocês, tem uma parte que você ainda não viu: <strong>o aplicativo</strong>.</p>

    <p>Nele a criança pinta as atividades <strong>direto na tela, com o dedo</strong>, sem precisar de impressora. E tem o jogo do Prato Limpo, em que ela destrava um personagem novo a cada alimento que prova.</p>

    <p>Junto vêm o cardápio de 4 semanas, o calendário, as cartelas, o quadro de progresso e as atualizações semanais do kit.</p>

    <p style="background:#E8F1DD; border-radius:10px; padding:14px 16px;">
      Você já pagou <strong>R$ 10,00</strong>.<br>
      Pra completar, é só <strong>R$ 17,90</strong>.<br>
      <span style="color:#7C857D; font-size:13px;">Quem compra o Completo direto paga R$ 37,00.</span>
    </p>

    <p style="text-align:center; margin:26px 0;">
      <a href="${url}" style="background:#5CA741; color:#fff; text-decoration:none; padding:14px 28px; border-radius:8px; font-weight:bold; display:inline-block;">Quero completar meu kit</a>
    </p>

    <p style="font-size:13px; color:#7C857D;">Se estiver bom do jeito que está, ignora esse e-mail sem problema nenhum. O que você comprou continua seu, com as atualizações incluídas.</p>
  </div>`;
}

module.exports = async (req, res) => {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return res.status(500).json({ error: 'CRON_SECRET não configurado' });
  if (req.headers.authorization !== `Bearer ${segredo}`) return res.status(401).json({ error: 'não autorizado' });

  const corte = Date.now() - DIAS * 24 * 60 * 60 * 1000;
  let tokens = [];
  try {
    tokens = (await redis('ZRANGE', 'upsell:fila', '-inf', String(corte), 'BYSCORE', 'LIMIT', '0', String(LOTE))) || [];
  } catch (err) {
    console.error('cron-upsell: falha ao ler a fila', err);
    return res.status(503).json({ error: 'fila indisponível' });
  }

  let enviados = 0, pulados = 0;
  for (const token of tokens) {
    // Tira da fila ANTES de mandar: se o envio falhar, a cliente fica sem o
    // e-mail, o que é bem melhor que a fila travar e todo mundo receber de novo
    // no dia seguinte.
    await redis('ZREM', 'upsell:fila', token).catch(() => {});

    let reg = null;
    try { reg = JSON.parse(await redis('GET', `dl:${token}`)); } catch {}
    if (!reg || !reg.email || reg.tierId !== 'essencial') { pulados++; continue; }

    const r = await sendEmail({
      to: reg.email,
      subject: 'Falta uma parte do seu Kit Prato Limpo',
      html: emailHtml({ nome: reg.name, url: `${BASE}/upgrade?t=${token}` }),
      replyTo: 'kitpratolimpo@gmail.com',
    });
    if (r && r.ok) enviados++; else pulados++;
  }

  return res.status(200).json({ ok: true, encontrados: tokens.length, enviados, pulados });
};
