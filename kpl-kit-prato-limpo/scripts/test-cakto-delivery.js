const assert = require('node:assert/strict');
const { handleCaktoWebhook, accessEmailHtml } = require('../lib/cakto-delivery');
const sharedWebhook = require('../api/webhook');

const originalSecret = process.env.CAKTO_WEBHOOK_SECRET;
const originalProduct = process.env.CAKTO_PRO_COMPLETE_PRODUCT_ID;
const originalPushToken = process.env.PUSHINPAY_WEBHOOK_TOKEN;
process.env.CAKTO_WEBHOOK_SECRET = 'segredo-teste';
process.env.CAKTO_PRO_COMPLETE_PRODUCT_ID = 'produto-completo';

const records = new Map();
const emails = [];
const links = [];
const redis = async (command, key, value, ...args) => {
  if (command === 'GET') return records.get(key) || null;
  if (command === 'EXISTS') return records.has(key) ? 1 : 0;
  if (command === 'DEL') return records.delete(key) ? 1 : 0;
  if (command === 'SET') {
    if (args.includes('NX') && records.has(key)) return null;
    records.set(key, value);
    return 'OK';
  }
  throw new Error(`Comando Redis inesperado: ${command}`);
};
const services = {
  redis,
  createDownloadLink: async (paymentId, email, name, tierId) => {
    assert.equal(tierId, 'profissional');
    links.push({ paymentId, email, name });
    const token = 'a'.repeat(48);
    records.set(`dltok:${paymentId}`, token);
    records.set(`dl:${token}`, JSON.stringify({ tierId }));
    return `https://kitpratolimpo.com.br/mi-kit?t=${token}`;
  },
  sendEmail: async (message) => { emails.push(message); return { ok: true }; },
};
const order = {
  id: 'pedido-teste-123', status: 'paid', offer_type: 'main',
  product: { id: 'produto-completo' },
  customer: { name: 'Ana <Teste>', email: 'ana@example.com' },
};

function response() {
  return {
    statusCode: 200,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function send(event, data = order, secret = 'segredo-teste') {
  const res = response();
  await handleCaktoWebhook({ body: { secret, event, data } }, res, services);
  return res;
}

(async () => {
  // O endpoint compartilhado ainda rejeita PushInPay com token errado antes de
  // consultar a API antiga. A Cakto segue pelo ramo novo.
  process.env.PUSHINPAY_WEBHOOK_TOKEN = 'pushinpay-teste';
  const oldGatewayResponse = response();
  await sharedWebhook({ method: 'POST', headers: { 'x-pushinpay-token': 'errado' }, body: { id: '123' } }, oldGatewayResponse);
  assert.equal(oldGatewayResponse.statusCode, 401);
  const caktoResponse = response();
  await sharedWebhook({ method: 'POST', headers: {}, body: { secret: 'errado', event: 'purchase_approved', data: order } }, caktoResponse);
  assert.equal(caktoResponse.statusCode, 401);

  assert.equal((await send('purchase_approved', order, 'errado')).statusCode, 401);
  assert.equal((await send('purchase_approved', { ...order, product: { id: 'outro' } })).body.results[0].ignored, true);
  assert.equal(links.length, 0);

  let res = await send('purchase_approved');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.results[0].delivered, true);
  assert.equal(links.length, 1);
  assert.equal(emails.length, 1);
  assert.match(emails[0].html, /mi-kit\?t=/);
  assert.doesNotMatch(emails[0].html, /Também mandamos o acesso no WhatsApp/);
  assert.match(accessEmailHtml('<Teste> Ana', 'https://example.com/'), /&lt;Teste&gt;,/);

  res = await send('purchase_approved');
  assert.equal(res.body.results[0].duplicate, true);
  assert.equal(emails.length, 1);

  res = await send('refund', { ...order, status: 'refunded' });
  assert.equal(res.body.results[0].revoked, true);
  assert.equal(records.has(`dl:${'a'.repeat(48)}`), false);

  const secondOrder = { ...order, id: 'pedido-teste-456' };
  res = await send('purchase_approved', [secondOrder]);
  assert.equal(res.body.results[0].delivered, true);
  assert.equal(emails.length, 2);

  const thirdOrder = { ...order, id: 'pedido-teste-789' };
  const failedResponse = response();
  const originalConsoleError = console.error;
  try {
    // Esta falha é intencional: testa se o evento fica apto a reenvio.
    console.error = () => {};
    await handleCaktoWebhook({ body: { secret: 'segredo-teste', event: 'purchase_approved', data: thirdOrder } }, failedResponse, {
      ...services,
      sendEmail: async () => ({ ok: false }),
    });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(failedResponse.statusCode, 503);
  assert.equal(records.has(`cakto:delivering:${thirdOrder.id}`), false);
  assert.equal(records.has(`cakto:delivered:${thirdOrder.id}`), false);

  console.log('Entrega Cakto: dois gateways, validação, produto, e-mail, idempotência, reembolso, falha e V2 OK');
})().catch((err) => { console.error(err); process.exitCode = 1; }).finally(() => {
  if (originalSecret === undefined) delete process.env.CAKTO_WEBHOOK_SECRET;
  else process.env.CAKTO_WEBHOOK_SECRET = originalSecret;
  if (originalProduct === undefined) delete process.env.CAKTO_PRO_COMPLETE_PRODUCT_ID;
  else process.env.CAKTO_PRO_COMPLETE_PRODUCT_ID = originalProduct;
  if (originalPushToken === undefined) delete process.env.PUSHINPAY_WEBHOOK_TOKEN;
  else process.env.PUSHINPAY_WEBHOOK_TOKEN = originalPushToken;
});
