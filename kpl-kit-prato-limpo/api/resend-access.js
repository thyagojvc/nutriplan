// POST /api/resend-access  { key, email, name?, tier?, paymentId? }
//
// Reenvia o acesso de uma compra pro cliente: cria um link novo e manda por
// e-mail. Devolve o link na resposta também, pra dar pra mandar no WhatsApp
// quando a cliente jura que e-mail nenhum chegou.
//
// POR QUE EXISTE (17/08): o Redis antigo bateu o teto de comandos do plano
// gratuito. Quando isso acontece, deliver-kit.js segue em frente de propósito
// (fail-open, pra não travar quem pagou), mas `createDownloadLink` falha e o
// e-mail de confirmação sai SEM o botão de acesso. A cliente paga, recebe um
// "pagamento confirmado" que não leva a lugar nenhum, e abre contestação.
// Foi exatamente isso que aconteceu com uma compra do Completo. Trocado o
// banco, os tokens antigos também morreram junto com ele, então não bastava
// reenviar o e-mail: o acesso precisa ser CRIADO de novo.
//
// Não passa pela PushInPay de propósito. deliver-kit.js exige status `paid`,
// e é justamente em compra contestada/estornada que mais se precisa reenviar
// (o dono decide entregar mesmo assim). Quem autoriza aqui é a chave do
// painel, mesma proteção do /funil e do delete-visitors.

const { sendEmail } = require('./_resend');
const { TIERS } = require('./_catalog');
const { createDownloadLink } = require('./_entrega');

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}

function emailHtml({ name, tierName, url }) {
  const primeiro = String(name || '').trim().split(/\s+/)[0];
  return `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #26302A;">
    <h1 style="font-size: 22px; margin-bottom: 8px;">Seu acesso ao Kit Prato Limpo 🍽️</h1>
    <p>${primeiro ? primeiro + ', d' : 'D'}esculpe pela demora. Tivemos uma falha técnica no envio e o seu acesso não saiu junto com a confirmação da compra.</p>
    <p>Está tudo certo com o seu pedido do <strong>${tierName}</strong>. Aqui está o acesso, funcionando:</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${url}" style="background: #5CA741; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; display: inline-block;">Acessar meu Kit Prato Limpo</a>
    </p>
    <p style="font-size: 13px; color: #7C857D; text-align: center;">Este link é só seu, ligado à sua compra. Guarde este e-mail para acessar de novo quando precisar.</p>
    <p>Se ainda assim não abrir, é só responder este e-mail que a gente resolve na hora.</p>
  </div>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const body = await readBody(req);

    if (!process.env.FUNNEL_DASHBOARD_KEY || body.key !== process.env.FUNNEL_DASHBOARD_KEY) {
      return res.status(401).json({ error: 'Chave inválida' });
    }

    const email = String(body.email || '').trim();
    if (!isEmail(email)) return res.status(400).json({ error: 'E-mail inválido' });

    const name = String(body.name || '').trim().slice(0, 80);
    const tierId = body.tier === 'essencial' ? 'essencial' : 'completo';
    const tierName = (TIERS[tierId] && TIERS[tierId].name) || 'KPL Completo';
    // Sem id da PushInPay em mãos, marca a origem: o registro fica rastreável
    // como reenvio manual em vez de se passar por uma venda comum.
    const paymentId = String(body.paymentId || '').trim() || `manual-${Date.now()}`;

    // Mesma criação de acesso da entrega normal (api/_entrega.js), pra o link
    // reenviado nunca divergir do que a compra gera.
    const url = await createDownloadLink(paymentId, email, name, tierId, { reenvio: true });
    if (!url) return res.status(503).json({ error: 'Não consegui criar o acesso agora. Tente de novo.' });

    const enviado = await sendEmail({
      to: email,
      subject: 'Seu acesso ao Kit Prato Limpo',
      html: emailHtml({ name, tierName, url }),
      replyTo: 'kitpratolimpo@gmail.com',
    });

    // Devolve o link mesmo se o e-mail falhar: com ele em mãos dá pra mandar
    // por WhatsApp, que é o que resolve quando o e-mail não chega.
    return res.status(200).json({ ok: true, emailEnviado: !!(enviado && enviado.ok), tier: tierId, url });
  } catch (err) {
    console.error('resend-access error', err);
    return res.status(500).json({ error: 'Erro ao reenviar o acesso' });
  }
};
