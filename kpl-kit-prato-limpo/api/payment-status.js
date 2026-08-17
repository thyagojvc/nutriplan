// GET /api/payment-status?id=<paymentId>
// Consulta o status da cobrança na PushInPay. Usado pelo polling de 5s do front.
// Retorna { status } normalizado: 'pending' | 'paid' | 'expired' | 'canceled'.

const API_URL = process.env.PUSHINPAY_API_URL || 'https://api.pushinpay.com.br';

function normalize(raw) {
  const s = String(raw || '').toLowerCase();
  if (['paid', 'approved', 'completed', 'concluida', 'concluída'].includes(s)) return 'paid';
  if (['expired', 'expirada'].includes(s)) return 'expired';
  if (['canceled', 'cancelled', 'cancelada', 'refused', 'failed'].includes(s)) return 'canceled';
  return 'pending';
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const id = (req.query && req.query.id) || new URL(req.url, 'http://x').searchParams.get('id');
  if (!id) return res.status(400).json({ error: 'id ausente' });

  const token = process.env.PUSHINPAY_TOKEN;
  if (!token) return res.status(500).json({ error: 'Gateway não configurado' });

  try {
    // Doc PushInPay: GET /api/transactions/{id}
    const ppRes = await fetch(`${API_URL}/api/transactions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!ppRes.ok) {
      // Em erro pontual do gateway, não derruba o polling: devolve pending.
      return res.status(200).json({ status: 'pending' });
    }

    const pp = await ppRes.json();
    return res.status(200).json({ status: normalize(pp.status) });
  } catch (err) {
    console.error('payment-status error', err);
    return res.status(200).json({ status: 'pending' });
  }
};
