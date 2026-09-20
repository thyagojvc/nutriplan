// POST /api/familia-link  { t: <token da nutricionista> }
//
// LINK DA FAMÍLIA (20/09). A licença da Edição Profissional deixa a
// nutricionista passar o app pras famílias que ela atende. Até aqui isso só
// dava pra fazer repassando o PRÓPRIO link dela, o que entregava junto a aba
// Consultório, as 60 fichas clínicas e o PDF profissional inteiro: uma cópia
// do produto de R$ 67,00 solta no WhatsApp de cada paciente.
//
// Este endpoint cria (ou reencontra) um segundo token, o da família, que abre
// o mesmo app SEM nada de profissional e sem download de PDF nenhum.
//
// O token é DERIVADO do dela por hash, não sorteado: clicar de novo devolve o
// mesmo link, então a cota de escrita do Redis não cresce com o uso e ela pode
// mandar o mesmo endereço pra quantas famílias quiser.
//
// Quem bloqueia o PDF é o `familia: true` do registro, lido por download.js e
// por kit-access.js. O tierId fica 'completo' só pra o app abrir com todas as
// abas da família (jogo, pintar, turma).

const crypto = require('crypto');
const { redis } = require('./_kv');

const TTL_SECONDS = 365 * 24 * 60 * 60;

function tokenDaFamilia(tokenPro) {
  const salt = process.env.KIT_TOKEN_SALT || 'kpl-familia';
  return crypto.createHash('sha256').update(salt + ':familia:' + tokenPro).digest('hex').slice(0, 48);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const token = String(body.t || '').trim();
  if (!/^[a-f0-9]{32,64}$/.test(token)) {
    return res.status(400).json({ error: 'Token inválido.' });
  }

  let raw;
  try {
    raw = await redis('GET', `dl:${token}`);
  } catch (err) {
    console.error('familia-link: redis indisponível', err);
    return res.status(503).json({ error: 'Serviço indisponível, tente de novo em instantes.' });
  }
  if (!raw) return res.status(404).json({ error: 'Token não encontrado.' });

  let record = {};
  try { record = JSON.parse(raw); } catch {}
  // Só a Edição Profissional tem licença de repasse. O plano só PDF não abre o
  // app, então também não tem link pra passar adiante.
  if (record.tierId !== 'profissional') {
    return res.status(403).json({ error: 'Esse acesso não é da Edição Profissional.' });
  }

  const famToken = tokenDaFamilia(token);
  const registro = {
    paymentId: record.paymentId || null,
    email: record.email || null,
    name: record.name || null,
    tierId: 'completo',
    familia: true,
    de: token,
    ts: Date.now(),
  };

  try {
    await redis('SET', `dl:${famToken}`, JSON.stringify(registro), 'EX', String(TTL_SECONDS));
  } catch (err) {
    console.error('familia-link: falhou ao gravar o token da família', err);
    return res.status(503).json({ error: 'Não conseguimos gerar o link agora. Tente de novo.' });
  }

  const base = (process.env.PUBLIC_BASE_URL || 'https://kitpratolimpo.com.br').replace(/\/+$/, '');
  return res.status(200).json({ url: `${base}/mi-kit?t=${famToken}` });
};
