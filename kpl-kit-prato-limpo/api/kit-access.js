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

const crypto = require('crypto');
const { redis } = require('./_kv');

module.exports = async (req, res) => {
  // POST = link da família (ver linkDaFamilia lá embaixo). Ele mora AQUI, e não
  // num arquivo próprio em api/, porque o plano da Vercel só permite 12 funções
  // por deploy e a conta já estava exatamente no limite: um arquivo a mais
  // derrubava o deploy inteiro com "No more than 12 Serverless Functions".
  if (req.method === 'POST') return linkDaFamilia(req, res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
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
  // profissional_pdf (19/09) tambem: o plano de R$ 32,90 e so o PDF.
  if (record.tierId === 'essencial' || record.tierId === 'profissional_pdf') {
    return res.status(200).json({ valid: true, appLocked: true, name: firstName });
  }

  // Edicao Profissional (18/09): o app ganha a aba Consultorio. A lista das 60
  // fichas (nomes imprevisiveis, ver scripts/build-consultorio-app.js) so sai
  // daqui, e so pra token profissional. E o que impede a nutricionista de ver
  // o mesmo app da mae, e impede qualquer um de achar as fichas sem pagar.
  if (record.tierId === 'profissional') {
    let consultorio = null;
    try { consultorio = require('./_consultorio.json'); } catch {}
    return res.status(200).json({
      valid: true, name: firstName, tier: 'profissional',
      consultorio,
      // Order bump do Bloco de Evolucao: so aparece o botao pra quem comprou.
      bloco: record.devolutiva === true,
    });
  }

  // familia: true vem do link que a nutricionista repassa (ver o POST abaixo).
  // O app usa isso pra esconder o botao de baixar o PDF.
  return res.status(200).json({ valid: true, name: firstName, familia: record.familia === true });
};

// ---------------------------------------------------------------------------
// POST /api/kit-access  { t: <token da nutricionista> }  ->  { url }
//
// LINK DA FAMÍLIA (20/09). A licença da Edição Profissional deixa a
// nutricionista passar o app pras famílias que ela atende. Até aqui isso só
// dava pra fazer repassando o PRÓPRIO link dela, o que entregava junto a aba
// Consultório, as 60 fichas clínicas e o PDF profissional inteiro: uma cópia
// do produto solta no WhatsApp de cada paciente.
//
// Aqui nasce um SEGUNDO token, o da família, que abre o mesmo app sem nada de
// profissional e sem download de PDF nenhum. Ele é DERIVADO do token dela por
// hash, não sorteado: clicar de novo devolve o mesmo link, então a cota de
// escrita do Redis não cresce com o uso e ela manda o mesmo endereço pra
// quantas famílias quiser.
//
// Quem bloqueia o PDF é o `familia: true` do registro, lido por download.js e
// pelo GET aqui de cima. O tierId fica 'completo' só pra o app abrir com as
// abas da família (fichas de casa, jogo, pintar, turma).
// ---------------------------------------------------------------------------

const TTL_FAMILIA_SECONDS = 365 * 24 * 60 * 60;

function tokenDaFamilia(tokenPro) {
  const salt = process.env.KIT_TOKEN_SALT || 'kpl-familia';
  return crypto.createHash('sha256').update(salt + ':familia:' + tokenPro).digest('hex').slice(0, 48);
}

async function linkDaFamilia(req, res) {
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
    console.error('link da família: redis indisponível', err);
    return res.status(503).json({ error: 'Serviço indisponível, tente de novo em instantes.' });
  }
  if (!raw) return res.status(404).json({ error: 'Token não encontrado.' });

  let record = {};
  try { record = JSON.parse(raw); } catch {}
  // Só a Edição Profissional tem licença de repasse. O plano só PDF nem abre o
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
    await redis('SET', `dl:${famToken}`, JSON.stringify(registro), 'EX', String(TTL_FAMILIA_SECONDS));
  } catch (err) {
    console.error('link da família: falhou ao gravar o token', err);
    return res.status(503).json({ error: 'Não conseguimos gerar o link agora. Tente de novo.' });
  }

  const base = (process.env.PUBLIC_BASE_URL || 'https://kitpratolimpo.com.br').replace(/\/+$/, '');
  return res.status(200).json({ url: `${base}/mi-kit?t=${famToken}` });
}
