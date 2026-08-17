// Helper compartilhado: reconsulta uma transação direto na PushInPay (fonte autoritativa).
// Usado por webhook.js e deliver-kit.js para nunca confiar em status vindo do cliente.

const API_URL = process.env.PUSHINPAY_API_URL || 'https://api.pushinpay.com.br';

// A PushInPay devolve o MESMO id em caixas diferentes dependendo do endpoint:
// a criação da cobrança (/api/pix/cashIn) responde em minúsculo e a consulta
// da transação (/api/transactions/<id>), que é o que o webhook usa, responde em
// MAIÚSCULO. Chave de Redis é sensível a caixa, então sem normalizar o webhook
// procurava `checkout:A286...` enquanto o dado estava salvo em `checkout:a286...`
// e nunca achava: a venda virava "órfã sem dados de contato" mesmo tendo
// nome/e-mail/telefone guardados, e a cliente ficava sem receber o kit.
// Também quebrava em silêncio duas outras coisas com o mesmo id:
//   - a trava `delivered:<id>` (webhook achava que NADA tinha sido entregue);
//   - o event_id `purchase_<id>` do Meta, que é o que desduplica pixel x CAPI.
// Normalizar em minúsculo (formato canônico de UUID) resolve os três.
function normalizeId(id) {
  return String(id || '').trim().toLowerCase();
}

async function fetchTransaction(id) {
  const token = process.env.PUSHINPAY_TOKEN;
  const r = await fetch(`${API_URL}/api/transactions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!r.ok) return null;
  return r.json();
}

module.exports = { fetchTransaction, normalizeId };
