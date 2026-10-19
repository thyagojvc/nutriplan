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

const { redis } = require('./_kv');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // GET /api/payment-status?vid=<id do visitante> (19/10): a pagina /obrigado
  // pergunta se a compra feita na Cakto ja liberou o acesso. Mora aqui pra nao
  // criar outra funcao (o plano da Vercel esta no limite de 12).
  const vid = String((req.query && req.query.vid) || new URL(req.url, 'http://x').searchParams.get('vid') || '')
    .replace(/[^\w-]/g, '').slice(0, 64);
  if (vid) {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const raw = await redis('GET', `vidacesso:${vid}`);
      if (!raw) return res.status(200).json({ status: 'pending' });
      const d = JSON.parse(raw);
      return res.status(200).json({ status: 'paid', url: d.url, plano: d.plano });
    } catch (err) {
      console.error('payment-status vid error', err);
      return res.status(200).json({ status: 'pending' });
    }
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
