// POST /api/webhook
// Recebe a notificação da PushInPay quando o pagamento muda de estado.
//
// A entrega principal do kit acontece em api/deliver-kit.js, disparada pelo
// front assim que o polling confirma o pagamento (é ali que temos o e-mail
// do cliente em mãos). Este webhook é a REDE DE SEGURANÇA: se a pessoa fechar
// a aba antes de o polling confirmar, avisamos o suporte por e-mail para
// entregar manualmente (não temos o e-mail do cliente guardado neste ponto).
//
// Segurança: a PushInPay não assina o corpo, então NÃO confiamos no que chega.
// Reconsultamos o status direto na API pelo id (fonte autoritativa) antes de agir.
// Também validamos o header x-pushinpay-token (ver PUSHINPAY_WEBHOOK_TOKEN).
//
// Variáveis de ambiente:
//   PUSHINPAY_TOKEN, PUSHINPAY_API_URL (opcional), PUSHINPAY_WEBHOOK_TOKEN (opcional)
//   RESEND_API_KEY, DELIVERY_FROM_EMAIL, ADMIN_ALERT_EMAIL

const { fetchTransaction } = require('./_pushinpay');
const { sendEmail } = require('./_resend');
const { sendCapiPurchase, resolveFbc } = require('./_fb-capi');
const { tierFromValueCents } = require('./_catalog');
const { redis } = require('./_kv');

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}

// Best-effort: busca o backup salvo em create-charge.js (nome/e-mail/telefone
// de ANTES do pagamento confirmar). Se o Redis falhar ou o registro não
// existir (ex.: cobrança criada antes desta função existir), cai pro
// comportamento antigo — só não vem com os dados prontos.
async function lookupCheckoutBackup(paymentId) {
  try {
    const raw = await redis('GET', `checkout:${paymentId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('webhook: falha ao buscar backup do checkout (seguindo sem os dados)', err);
    return null;
  }
}

// Rede de segurança: avisa o suporte para conferir/entregar manualmente.
// Não é a entrega ao cliente (isso é o api/deliver-kit.js).
async function deliverKit(transaction) {
  const backup = await lookupCheckoutBackup(transaction.id);

  // Purchase pro Meta: nesse caminho órfão (aba fechada antes do polling
  // confirmar), NEM o pixel do navegador NEM o CAPI de deliver-kit.js chegam
  // a disparar — a venda simplesmente não é reportada, o que faz o algoritmo
  // de otimização de anúncio subcontar conversões reais. mesmo event_id
  // (purchase_<id>) do pixel/deliver-kit.js: se por algum motivo os dois
  // caminhos dispararem pro mesmo pagamento, o Meta desduplica, não conta 2x.
  // fbc reconstruído a partir do fbclid salvo em create-charge.js — sem ele,
  // o Meta conta a compra mas não sabe de qual anúncio ela veio.
  const fbc = backup && backup.fbclid ? resolveFbc({}, backup.fbclid) : null;
  sendCapiPurchase({
    paymentId: transaction.id,
    email: backup && backup.email,
    name: backup && backup.name,
    phone: backup && backup.phone,
    valueCents: transaction.value || 0,
    fbc,
  }).catch((err) => console.error('webhook: capi purchase error', err));

  // Registra no painel /funil (sorted set kpl:sales) igual o deliver-kit.js já
  // faz no fluxo normal — sem isso, TODA venda que passa pelo caminho órfão
  // (aba fechada antes do polling confirmar) fica invisível no funil pra
  // sempre, mesmo tendo sido entregue e cobrada certinho. Não bloqueia a
  // resposta do webhook se o Redis falhar (é só métrica).
  const valorCents = Number(transaction.value || 0);
  const tierName = tierFromValueCents(valorCents).name;
  const firstName = ((backup && backup.name) || '').trim().split(/\s+/)[0] || 'Cliente';
  const adRef = (backup && backup.adRef) || 'Sem anúncio';
  const now = Date.now();
  Promise.resolve()
    .then(() => redis('ZADD', 'kpl:sales', String(now), JSON.stringify({ n: firstName, t: tierName, v: valorCents, a: adRef, i: null, ts: now })))
    .then(() => redis('ZREMRANGEBYRANK', 'kpl:sales', 0, -501))
    .catch((err) => console.error('webhook: sales record error', err));

  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (!adminEmail) {
    console.log('[WEBHOOK] pagamento aprovado, sem ADMIN_ALERT_EMAIL configurado', transaction.id);
    return;
  }
  const valor = ((transaction.value || 0) / 100).toFixed(2);
  const dadosClienteHtml = backup
    ? `<p><strong>Dados do checkout (recuperados automaticamente):</strong><br>
       Nome: ${backup.name || '(não informado)'}<br>
       E-mail: ${backup.email || '(não informado)'}<br>
       WhatsApp: ${backup.phone || '(não informado)'}</p>`
    : `<p>Não achei os dados do checkout pra essa transação — procure por esse ID no painel da PushInPay para achar os dados dele e entregar manualmente.</p>`;
  await sendEmail({
    to: adminEmail,
    subject: `Pix aprovado via webhook: ${transaction.id}`,
    html: `<p>Pagamento aprovado direto pelo webhook da PushInPay (fora do fluxo normal de tela de sucesso).</p>
           <p>ID da transação: ${transaction.id}<br>Valor: R$ ${valor}</p>
           ${dadosClienteHtml}`,
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const expectedToken = process.env.PUSHINPAY_WEBHOOK_TOKEN;
  if (expectedToken && req.headers['x-pushinpay-token'] !== expectedToken) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  try {
    const body = await readBody(req);
    const id = body.id || (body.data && body.data.id) || body.transaction_id;
    if (!id) return res.status(400).json({ error: 'id ausente no webhook' });

    // Reconsulta autoritativa
    const tx = await fetchTransaction(id);
    const status = String((tx && tx.status) || body.status || '').toLowerCase();

    if (['paid', 'approved', 'completed'].includes(status)) {
      // Se o fluxo normal (api/deliver-kit.js) já rodou pra este pagamento, o
      // cliente já recebeu e o admin já foi avisado — não é o caso órfão que
      // este webhook existe pra cobrir. Mesma chave `delivered:<id>` que o
      // deliver-kit grava (SET...NX), só que aqui é leitura, nunca escrita: o
      // webhook não faz a entrega de verdade, então não deve reivindicar a trava.
      let jaEntregue = false;
      try {
        jaEntregue = !!(await redis('EXISTS', `delivered:${id}`));
      } catch (err) {
        console.error('webhook: falha ao checar delivered (segue como órfão)', err);
      }

      if (!jaEntregue) {
        // Trava própria do webhook: evita mandar o alerta de "órfão" mais de
        // uma vez se a PushInPay reenviar a notificação (o antigo Set em
        // memória não sobrevivia entre invocações serverless — cada cold
        // start começava um Set vazio, então na prática nunca deduplicava).
        let jaAlertado = true;
        try {
          const lock = await redis('SET', `webhook-notified:${id}`, '1', 'NX', 'EX', 86400);
          jaAlertado = lock !== 'OK';
        } catch (err) {
          console.error('webhook: falha na trava de alerta (segue e manda mesmo assim)', err);
          jaAlertado = false;
        }
        if (!jaAlertado) await deliverKit(tx || { id });
      }
    }

    // Responde 200 rápido para a PushInPay não reenviar em loop.
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('webhook error', err);
    // 200 mesmo em erro interno para não gerar retries infinitos;
    // logamos para investigar. Ajuste se preferir retry do gateway.
    return res.status(200).json({ received: true });
  }
};
