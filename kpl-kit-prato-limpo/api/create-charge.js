// POST /api/create-charge
// Cria uma cobrança Pix na PushInPay a partir dos dados do cliente + bumps.
// O valor é SEMPRE recalculado aqui (nunca confiamos no total vindo do front).
//
// Variáveis de ambiente necessárias (Vercel → Settings → Environment Variables):
//   PUSHINPAY_TOKEN     -> token da API PushInPay (NUNCA no front)
//   PUSHINPAY_API_URL   -> opcional, default https://api.pushinpay.com.br
//   PUBLIC_BASE_URL     -> ex.: https://seu-dominio.vercel.app (para montar o webhook_url)

const { computeOrder } = require('./_catalog');
const { redis } = require('./_kv');

// Guarda nome/e-mail/telefone ANTES do pagamento confirmar, como rede de
// segurança pro caso "webhook órfão": cliente paga, fecha a aba antes do
// polling confirmar (que é quem normalmente leva esses dados pro
// deliver-kit.js), e a gente fica sem contato nenhum pra entregar na mão.
// Sem isso, esse caso é IRRECUPERÁVEL: a PushInPay não recebe e-mail/telefone
// da cliente, só nome e CPF do banco dela.
// Best-effort de propósito (nunca trava o checkout): 1 escrita por cobrança
// criada, nada parecido com o polling do painel que estourou a cota.
async function saveCheckoutBackup(paymentId, customer, fbclid) {
  try {
    await redis(
      'SET', `checkout:${paymentId}`,
      JSON.stringify({
        name: customer.name, email: customer.email, phone: customer.phone,
        // fbclid também vai junto: sem ele, um Purchase disparado no caminho
        // órfão do webhook (ver webhook.js) não tem como o Meta ligar de volta
        // ao anúncio que trouxe a venda — vira só uma compra "solta" no total.
        fbclid: fbclid || null,
        ts: Date.now(),
      }),
      'EX', 172800, // 48h: tempo de sobra pra qualquer confirmação/reclamação chegar
    );
  } catch (err) {
    console.error('create-charge: falha ao salvar backup do checkout (seguindo mesmo assim)', err);
  }
}

const API_URL = process.env.PUSHINPAY_API_URL || 'https://api.pushinpay.com.br';

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}

// Validações mínimas no servidor (o front já valida, isto é a segunda camada)
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');
function isValidCPF(cpf) {
  cpf = String(cpf || '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let s = 0; for (let i = 0; i < 9; i++) s += +cpf[i] * (10 - i);
  let d1 = (s * 10) % 11; if (d1 === 10) d1 = 0; if (d1 !== +cpf[9]) return false;
  s = 0; for (let i = 0; i < 10; i++) s += +cpf[i] * (11 - i);
  let d2 = (s * 10) % 11; if (d2 === 10) d2 = 0; return d2 === +cpf[10];
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const body = await readBody(req);
    const customer = body.customer || {};
    const method = body.method || 'pix';

    // --- Cartão: arquitetura pronta, porém DESLIGADA por decisão de negócio ---
    if (method === 'card') {
      return res.status(501).json({
        error: 'Pagamento com cartão está desativado. Use Pix.',
        // Para religar cartão no futuro: plugar aqui um gateway de cartão e
        // devolver o formato que o front espera. O restante do fluxo já suporta.
      });
    }

    // --- Validação do cliente ---
    const name = String(customer.name || '').trim();
    const email = String(customer.email || '').trim();
    const cpf = String(customer.cpf || '').replace(/\D/g, '');
    const phone = String(customer.phone || '').replace(/\D/g, '');

    if (name.length < 5 || !isEmail(email) || !isValidCPF(cpf) || phone.length < 10) {
      return res.status(400).json({ error: 'Dados do cliente inválidos.' });
    }

    // --- Total confiável (servidor manda) — a partir do tier + bumps ---
    const { items, totalCents, tierId, tierName } = computeOrder(body.tier, body.bumps);

    const token = process.env.PUSHINPAY_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'Gateway não configurado (PUSHINPAY_TOKEN ausente).' });
    }

    const webhookUrl = process.env.PUBLIC_BASE_URL
      ? `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/webhook`
      : undefined;

    // --- Chamada à PushInPay: cria cobrança Pix ---
    // Doc: POST /api/pix/cashIn  { value: <centavos>, webhook_url }
    const ppRes = await fetch(`${API_URL}/api/pix/cashIn`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        value: totalCents, // PushInPay trabalha em centavos
        webhook_url: webhookUrl,
      }),
    });

    if (!ppRes.ok) {
      const detail = await ppRes.text().catch(() => '');
      console.error('PushInPay create error', ppRes.status, detail);
      return res.status(502).json({ error: 'Falha ao criar cobrança no gateway.' });
    }

    const pp = await ppRes.json();

    if (pp.id) await saveCheckoutBackup(pp.id, { name, email, phone }, body.fbclid ? String(body.fbclid).slice(0, 500) : null);

    // PushInPay devolve: id, qr_code (copia e cola), qr_code_base64 (imagem), status, value
    const qrBase64 = pp.qr_code_base64 || pp.qrCodeBase64 || '';
    return res.status(200).json({
      paymentId: pp.id,
      amountCents: totalCents,
      tierId,
      tierName,
      items,
      pix: {
        copiaECola: pp.qr_code || pp.qrCode || '',
        qrCodeImage: qrBase64, // pode vir como data:image/... ou base64 puro; o front trata os dois
      },
      status: (pp.status || 'pending').toLowerCase(),
    });
  } catch (err) {
    console.error('create-charge fatal', err);
    return res.status(500).json({ error: 'Erro interno ao gerar a cobrança.' });
  }
};
