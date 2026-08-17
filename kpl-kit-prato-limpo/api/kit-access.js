// GET /api/kit-access?t=<token>
//
// Endpoint que mi-kit.html chama por fetch pra decidir o que mostrar na tela.
// Não entrega nada (isso é papel do api/download.js): só confirma se o token
// é de uma compra de verdade. mi-kit.html só desenha o botão de download depois
// que esta chamada responde valid:true — a intenção é que a opção de baixar
// nem exista na tela pra quem não comprou, não só que o link por trás falhe.
//
// Mesma trava de formato e fail-CLOSED do api/download.js (ver comentário lá
// pra entender por que aqui é o oposto do fail-OPEN de deliver-kit.js). Não
// mexe no contador de downloads (dlc:) nem faz nenhuma escrita.

const { redis } = require('./_kv');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const token = String((req.query && req.query.t) || '').trim();

  if (!/^[a-f0-9]{32,64}$/.test(token)) {
    return res.status(200).json({ valid: false });
  }

  let raw;
  try {
    raw = await redis('GET', `dl:${token}`);
  } catch (err) {
    console.error('kit-access: redis indisponível', err);
    return res.status(503).json({ valid: false, retry: true });
  }

  if (!raw) {
    return res.status(200).json({ valid: false });
  }

  let record = {};
  try { record = JSON.parse(raw); } catch {}

  const firstName = String(record.name || '').trim().split(/\s+/)[0] || null;

  // O app (esta página) é vendido como exclusivo do Completo. Quem comprou o
  // Essencial tem token válido — pagou de verdade — só não pra ISSO aqui. Em
  // vez de tratar como link inválido (o que seria falso e rude com quem
  // pagou), avisa e devolve o link direto do PDF dela.
  if (record.tierId === 'essencial') {
    return res.status(200).json({ valid: true, appLocked: true, name: firstName });
  }

  return res.status(200).json({ valid: true, name: firstName });
};
