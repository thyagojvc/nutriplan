// Entrega da Edição Profissional Completa comprada pela Cakto.
// O endpoint público continua sendo /api/webhook, compartilhado com a
// PushInPay para não aumentar o número de funções no deploy da Vercel.
//
// Configurar na Vercel: CAKTO_WEBHOOK_SECRET e
// CAKTO_PRO_COMPLETE_PRODUCT_ID. O webhook da Cakto deve assinar somente
// purchase_approved, refund e chargeback do produto Completo.
//
// O parser da função existente já consome o JSON antes desta rotina. Por isso
// validamos o `secret` do corpo em comparação de tempo constante — método
// documentado pela Cakto quando o corpo cru não está disponível para HMAC.

const crypto = require('crypto');
const { redis } = require('../api/_kv');
const { sendEmail } = require('../api/_resend');
const { createDownloadLink, linksDosBonus, DOWNLOAD_TTL_SECONDS } = require('../api/_entrega');

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');

function sameSecret(received, expected) {
  if (!received || !expected) return false;
  const a = Buffer.from(String(received));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function accessEmailHtml(name, accessUrl) {
  const firstName = escapeHtml(String(name || '').trim().split(/\s+/)[0] || 'Olá');
  const bonus = linksDosBonus('profissional', accessUrl);
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#26302a;line-height:1.5">
    <h1 style="font-size:22px">Seu Kit Prato Limpo Profissional está liberado 🍽️</h1>
    <p>${firstName}, seu pagamento do <strong>Plano Completo</strong> foi confirmado.</p>
    <p>No link abaixo você encontra o aplicativo, as fichas em PDF e os materiais do plano:</p>
    <p style="text-align:center;margin:28px 0"><a href="${accessUrl}" style="background:#4e9f38;color:#fff;text-decoration:none;padding:15px 24px;border-radius:9px;font-weight:bold;display:inline-block">Acessar meu Kit Profissional</a></p>
    <p style="font-size:13px;color:#59645b">O link é individual. Guarde este e-mail para voltar ao material quando precisar.</p>
    ${bonus ? `<p><strong>Seus bônus:</strong><br><a href="${bonus.mapa}">Mapa das 12 etapas</a><br><a href="${bonus.pacote}">Pacote de 8 sessões</a></p>` : ''}
    <p>Para enviar o app às famílias, entre na aba <strong>Consultório</strong> e use <strong>Gerar o link da família</strong>. Esse link não mostra as fichas profissionais.</p>
    <p>Dificuldade para abrir? Escreva para <a href="mailto:kitpratolimpo@gmail.com">kitpratolimpo@gmail.com</a>.</p>
  </div>`;
}

async function readPayload(req) {
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 262144) reject(new Error('Webhook muito grande'));
    });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch (err) { reject(err); } });
    req.on('error', reject);
  });
}

function familyToken(proToken) {
  const salt = process.env.KIT_TOKEN_SALT || 'kpl-familia';
  return crypto.createHash('sha256').update(salt + ':familia:' + proToken).digest('hex').slice(0, 48);
}

async function revokeAccess(orderId, services) {
  const paymentId = `cakto-${orderId}`;
  const token = await services.redis('GET', `dltok:${paymentId}`);
  if (!token) return;
  await services.redis('DEL', `dl:${familyToken(token)}`);
  await services.redis('DEL', `dl:${token}`);
  await services.redis('DEL', `dltok:${paymentId}`);
}

async function deliverOrder(order, services) {
  // O mesmo produto pode ser vendido como oferta principal ou upsell; o ID
  // do produto, não o tipo da oferta, define qual acesso liberar.
  if (order.status !== 'paid') return { ignored: true };
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(String(order.id || ''))) throw new Error('ID do pedido Cakto inválido');

  const email = String((order.customer && order.customer.email) || '').trim();
  if (!isEmail(email)) throw new Error('Pedido Cakto sem e-mail válido');
  const name = String((order.customer && order.customer.name) || '').trim().slice(0, 80);
  const orderId = order.id;

  if (await services.redis('EXISTS', `cakto:delivered:${orderId}`)) return { duplicate: true };
  const lockKey = `cakto:delivering:${orderId}`;
  const lock = await services.redis('SET', lockKey, '1', 'NX', 'EX', 300);
  if (lock !== 'OK') return { processing: true };

  try {
    const accessUrl = await services.createDownloadLink(
      `cakto-${orderId}`, email, name, 'profissional', { gateway: 'cakto' });
    if (!accessUrl) throw new Error('Não foi possível criar o acesso individual');

    const sent = await services.sendEmail({
      to: email,
      subject: 'Seu acesso ao Kit Prato Limpo Profissional Completo',
      html: accessEmailHtml(name, accessUrl),
      replyTo: 'kitpratolimpo@gmail.com',
    });
    if (!sent || !sent.ok) throw new Error('E-mail de acesso não enviado');

    await services.redis('SET', `cakto:delivered:${orderId}`, '1', 'EX', DOWNLOAD_TTL_SECONDS);
    return { delivered: true };
  } finally {
    await services.redis('DEL', lockKey).catch((err) => {
      console.error('cakto: falha ao liberar trava de entrega', err);
    });
  }
}

async function handleCaktoWebhook(req, res, overrides = {}) {
  res.setHeader('Cache-Control', 'no-store');
  const secret = process.env.CAKTO_WEBHOOK_SECRET;
  const productId = process.env.CAKTO_PRO_COMPLETE_PRODUCT_ID;
  if (!secret || !productId) return res.status(503).json({ error: 'Entrega Cakto não configurada' });

  let payload;
  try { payload = await readPayload(req); }
  catch { return res.status(400).json({ error: 'JSON inválido' }); }

  if (!sameSecret(payload.secret, secret)) return res.status(401).json({ error: 'Não autorizado' });
  if (!['purchase_approved', 'refund', 'chargeback'].includes(payload.event)) {
    return res.status(200).json({ received: true, ignored: true });
  }

  const services = { redis, sendEmail, createDownloadLink, ...overrides };
  const orders = Array.isArray(payload.data) ? payload.data : [payload.data];
  try {
    const results = [];
    for (const order of orders) {
      if (!order || String((order.product && order.product.id) || '') !== productId) {
        results.push({ ignored: true });
        continue;
      }
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(String(order.id || ''))) {
        throw new Error('ID do pedido Cakto inválido');
      }
      if (payload.event === 'purchase_approved') {
        results.push(await deliverOrder(order, services));
      } else {
        await revokeAccess(order.id, services);
        results.push({ revoked: true });
      }
    }
    return res.status(200).json({ received: true, results });
  } catch (err) {
    // A Cakto não repete automaticamente respostas 5xx. O erro fica visível
    // no histórico de webhooks e precisa de reenvio manual após a correção.
    console.error('cakto: entrega falhou', err);
    return res.status(503).json({ error: 'Falha na entrega; reenviar evento no painel Cakto' });
  }
}

module.exports = { handleCaktoWebhook, sameSecret, accessEmailHtml };
