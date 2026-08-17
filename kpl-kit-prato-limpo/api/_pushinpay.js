// Helper compartilhado: reconsulta uma transação direto na PushInPay (fonte autoritativa).
// Usado por webhook.js e deliver-kit.js para nunca confiar em status vindo do cliente.

const API_URL = process.env.PUSHINPAY_API_URL || 'https://api.pushinpay.com.br';

async function fetchTransaction(id) {
  const token = process.env.PUSHINPAY_TOKEN;
  const r = await fetch(`${API_URL}/api/transactions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!r.ok) return null;
  return r.json();
}

module.exports = { fetchTransaction };
