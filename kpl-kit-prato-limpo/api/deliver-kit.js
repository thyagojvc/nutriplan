// POST /api/deliver-kit
// Chamado pelo front assim que o polling detecta pagamento confirmado (tela de sucesso).
// Reconsulta a PushInPay pelo id (fonte autoritativa) antes de agir: nunca confiamos
// que o front está dizendo a verdade sobre o status.
//
// ENTREGA ATUAL: quem compra o Completo recebe no e-mail um link pra
// /mi-kit?t=<token>, uma "casca de app" (mi-kit.html) que só mostra o botão
// de baixar depois de confirmar por fetch (api/kit-access.js) que o token é
// de uma compra de verdade. Quem compra o Essencial recebe o link direto de
// /api/download — o app é vendido como exclusivo do Completo no site
// (index.html, seção #app-preview e a lista do plano), então quem não pagou
// por ele não recebe o link, ponto. O token em si é criado aqui, guardado no
// Redis e conferido de novo em api/download.js na hora de liberar o arquivo
// (a página /mi-kit não é o portão, é só a vitrine — quem barra de verdade é
// o download.js). O PDF mora em entrega/kit-prato-limpo-<hash>.pdf (gerar com
// scripts/build-kit-pdf.js sempre que fichas-geradas/ mudar) e nunca aparece
// pro cliente. Em paralelo,
// uma automação externa no e-mail do Thyago também dispara o material pelo
// WhatsApp do cliente. Este endpoint faz duas coisas quando o pagamento é
// confirmado:
//   1. Manda o e-mail de confirmação/recibo com o link pra /mi-kit pro cliente.
//   2. Avisa ADMIN_ALERT_EMAIL como REGISTRO (não é mais "enviar manualmente").
//
// O webhook (api/webhook.js) é a rede de segurança: se a pessoa fechar a aba antes
// de o polling confirmar, ele avisa o suporte.
//
// Variáveis de ambiente:
//   RESEND_API_KEY, DELIVERY_FROM_EMAIL -> ver api/_resend.js
//   ADMIN_ALERT_EMAIL -> para onde vai o registro de venda confirmada

const crypto = require('crypto');
const { fetchTransaction, normalizeId } = require('./_pushinpay');
const { sendEmail } = require('./_resend');
const { sendCapiPurchase, parseCookies, resolveFbc } = require('./_fb-capi');
const { tierFromValueCents } = require('./_catalog');
const { redis } = require('./_kv');

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}

// Um ano: a cliente compra hoje e pode querer reimprimir a ficha daqui a meses.
const DOWNLOAD_TTL_SECONDS = 365 * 24 * 60 * 60;

// Cria o acesso exclusivo da compra. O Completo ganha o link pra /mi-kit (a
// casca de app); o Essencial ganha o link direto do PDF — o app é vendido
// como diferencial só do Completo, então é isso mesmo que separa os dois na
// prática, não só no texto da página. Devolve null se o Redis falhar — nesse
// caso o e-mail sai sem botão, em vez de sair com um botão quebrado.
async function createDownloadLink(paymentId, email, name, tierId) {
  try {
    const token = crypto.randomBytes(24).toString('hex');
    await redis('SET', `dl:${token}`, JSON.stringify({ paymentId, email, name, tierId, ts: Date.now() }), 'EX', DOWNLOAD_TTL_SECONDS);
    // Guarda o caminho inverso pra dar suporte ("perdi o e-mail") sem precisar
    // varrer o banco atrás do token.
    await redis('SET', `dltok:${paymentId}`, token, 'EX', DOWNLOAD_TTL_SECONDS);
    const base = (process.env.PUBLIC_BASE_URL || 'https://kitpratolimpo.com.br').replace(/\/+$/, '');
    const isCompleto = tierId === 'completo' || tierId === 'completo_promo';
    return isCompleto ? `${base}/mi-kit?t=${token}` : `${base}/api/download?t=${token}`;
  } catch (err) {
    console.error('deliver-kit: falhou ao criar token de download', err);
    return null;
  }
}

function confirmationEmailHtml({ name, tierName, downloadUrl }) {
  const firstName = String(name || '').trim().split(' ')[0] || 'oi';
  const downloadBlock = downloadUrl
    ? `<p style="text-align: center; margin: 24px 0;">
      <a href="${downloadUrl}" style="background: #5CA741; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; display: inline-block;">Acessar meu Kit Prato Limpo</a>
    </p>
    <p style="font-size: 13px; color: #7C857D; text-align: center;">Este link é só seu, ligado à sua compra. Guarde este e-mail para acessar de novo quando precisar.</p>`
    : `<p>Seu material chega pelo WhatsApp que você cadastrou no checkout, em instantes.</p>`;

  return `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #26302A;">
    <h1 style="font-size: 22px; margin-bottom: 8px;">Pagamento confirmado! 🍽️</h1>
    <p>${firstName}, recebemos seu pagamento do <strong>${tierName}</strong>.</p>
    ${downloadBlock}
    <p>O material também chega no WhatsApp que você cadastrou no checkout, em instantes.</p>
    <p>Se o botão acima não funcionar ou não chegar nada no WhatsApp, escreva para <a href="mailto:kitpratolimpo@gmail.com">kitpratolimpo@gmail.com</a> que resolvemos rapidamente.</p>
    <p style="margin-top: 24px;">Guarde este e-mail como comprovante da sua compra.</p>
  </div>`;
}

function adminAlertHtml({ name, email, phone, paymentId, valor, tierName, downloadUrl }) {
  const linkWarning = downloadUrl
    ? ''
    : '<p style="color:#c0392b"><strong>ATENÇÃO: não foi possível gerar o link de download desta compra (Redis falhou). O e-mail saiu sem botão. Envie o material manualmente.</strong></p>';
  return `
    <p><strong>Venda confirmada (${tierName}) — entrega automática pelo WhatsApp.</strong></p>
    ${linkWarning}
    <p>Registro do pedido (a automação já dispara o envio; confira se caiu):</p>
    <p>Plano: ${tierName}<br>
       Nome: ${name || '(não informado)'}<br>
       WhatsApp: ${phone || '(não informado)'}<br>
       E-mail: ${email}<br>
       ID da transação: ${paymentId}<br>
       Valor: R$ ${valor}</p>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const body = await readBody(req);
    // normalizeId: mesma caixa das chaves do Redis (`delivered:`, `dltok:`) e do
    // event_id `purchase_<id>` que o webhook usa, senão a trava de idempotência
    // e a desduplicação do Meta não casam entre os dois caminhos.
    const paymentId = normalizeId(body.paymentId);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const phone = String(body.phone || '').trim();

    if (!paymentId || !isEmail(email)) {
      return res.status(400).json({ error: 'Dados inválidos.' });
    }

    const tx = await fetchTransaction(paymentId);
    const status = String((tx && tx.status) || '').toLowerCase();
    if (!['paid', 'approved', 'completed'].includes(status)) {
      return res.status(409).json({ error: 'Pagamento ainda não confirmado.' });
    }

    // Trava de idempotência: sem isto, toda vez que este endpoint é chamado de
    // novo pro MESMO pagamento (polling que dispara mais de uma vez, cliente
    // reabrindo a aba, retry de rede) ele reenvia e-mail pro cliente, reenvia
    // alerta pro admin, redispara o Purchase no Meta E duplica a venda no
    // /funil. Foi assim que uma única venda de R$10 virou 28 entradas em
    // kpl:sales em menos de 1 segundo (14/08). SET...NX só grava se a chave
    // ainda não existe — dá pra usar como trava atômica sem transação.
    // Fail-OPEN: se o Redis falhar aqui, seguimos como se fosse a 1ª vez.
    // Entregar de novo por engano é recuperável; NÃO entregar por causa de um
    // Redis instável (e a cliente pagou e não recebe nada) não é.
    let alreadyDelivered = false;
    try {
      const lock = await redis('SET', `delivered:${paymentId}`, '1', 'NX', 'EX', 86400);
      alreadyDelivered = lock !== 'OK';
    } catch (err) {
      console.error('delivery lock error (seguindo mesmo assim)', err);
    }
    if (alreadyDelivered) {
      return res.status(200).json({ delivered: true, duplicate: true });
    }

    // Number(): a PushInPay às vezes devolve o valor como texto ("2990"), e
    // sem isso ele ia parar como string no registro da venda (kpl:sales),
    // quebrando a soma do faturamento no /funil (concatenação em vez de soma).
    const valorCents = Number((tx && tx.value) || 0);
    const valor = (valorCents / 100).toFixed(2);
    const tier = tierFromValueCents(valorCents);
    const tierName = tier.name;
    const clientIpAddress = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;

    // Registra a venda no painel /funil (sorted set por tempo). Não bloqueia a
    // entrega se o Redis falhar — é só métrica.
    //
    // Trava `sale-logged:<id>` própria, além da `delivered:<id>` acima: aquela
    // trava impede reentrega, mas não fecha a corrida com o webhook.js (rede
    // de segurança do pagamento órfão), que faz sua PRÓPRIA leitura de
    // `delivered:id` antes de decidir se grava em kpl:sales. Se os dois
    // caminhos chegarem quase juntos pro mesmo pagamento, ambos podem passar
    // pelo check antes de qualquer um marcar `delivered:id` — e cada um grava
    // sua própria linha (uma com IP de verdade, outra com `i: null`, a
    // assinatura do webhook). Com essa trava extra, só quem chegar primeiro
    // grava a venda; o outro vê o lock já tomado e não duplica.
    const now = Date.now();
    const adRef = String(body.adRef || '').replace(/[^\w\s\-.|:/]/g, '').trim().slice(0, 120) || 'Sem anúncio';
    const firstName = (name || '').trim().split(/\s+/)[0] || 'Cliente';
    redis('SET', `sale-logged:${paymentId}`, '1', 'NX', 'EX', 86400)
      .then((lock) => {
        if (lock !== 'OK') return null;
        return Promise.resolve()
          .then(() => redis('ZADD', 'kpl:sales', String(now), JSON.stringify({ n: firstName, t: tierName, v: valorCents, a: adRef, i: clientIpAddress, ts: now })))
          .then(() => redis('ZREMRANGEBYRANK', 'kpl:sales', 0, -501));
      })
      .catch((err) => console.error('sales record error', err));

    const cookies = parseCookies(req);
    const fbc = resolveFbc(cookies, body.fbclid ? String(body.fbclid).slice(0, 500) : null);
    const fbp = cookies._fbp || null;
    const clientUserAgent = req.headers['user-agent'] || null;

    // Link exclusivo desta compra. Precisa existir antes do e-mail sair.
    const downloadUrl = await createDownloadLink(paymentId, email, name, tier.id);

    const [customerResult] = await Promise.all([
      sendEmail({
        to: email,
        subject: 'Pagamento confirmado! Kit Prato Limpo a caminho 🍽️',
        html: confirmationEmailHtml({ name, tierName, downloadUrl }),
        // Cliente costuma responder o e-mail de entrega em vez de escrever pro
        // suporte. Sem reply_to, essa resposta cai na caixa do remetente
        // técnico (entrega@nutriplan.email) e ninguém vê.
        replyTo: 'kitpratolimpo@gmail.com',
      }),
      process.env.ADMIN_ALERT_EMAIL
        ? sendEmail({
            to: process.env.ADMIN_ALERT_EMAIL,
            subject: `Venda confirmada — ${tierName}: ${name || email}`,
            html: adminAlertHtml({ name, email, phone, paymentId, valor, tierName, downloadUrl }),
          })
        : Promise.resolve({ ok: false }),
      // Purchase com dados completos (mesmo event_id do pixel client-side, ver
      // onPaid() em index.html: 'purchase_' + paymentId, pro Meta desduplicar).
      sendCapiPurchase({ paymentId, email, name, phone, valueCents: valorCents, fbc, fbp, clientUserAgent, clientIpAddress })
        .catch((err) => console.error('capi purchase error', err)),
    ]);

    return res.status(200).json({ delivered: !!customerResult.ok });
  } catch (err) {
    console.error('deliver-kit fatal', err);
    return res.status(500).json({ error: 'Erro ao processar a confirmação.' });
  }
};
