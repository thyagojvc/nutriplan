// POST /api/presence
// Heartbeat de "quem está na página agora": o front chama isto a cada ~8s com a
// seção visível atual + a seção mais profunda alcançada + o anúncio de origem.
// Grava tudo no hash do visitante, pra o painel /funil montar funil de abandono,
// criativos, dispositivo e sistema, tudo filtrável por período.
//   presence:<visitorId>  = seção atual, expira em 45s (sem beat novo, some = "ao vivo")
//   visitor:<visitorId>   = hash: firstSeen/lastSeen/lastSection/maxSection/device/platform/adRef/ip
//   individuals           = sorted set (score = lastSeen) pros mais recentes
//
// device/platform/ip são derivados do request aqui no servidor (confiável, o
// front nunca manda isso). ip = x-forwarded-for (Vercel roteia atrás de proxy).
// Fire-and-forget do ponto de vista do front: não bloqueia a navegação.

const { redisPipeline } = require('./_kv');
const { SECTIONS, QUIZ_STEPS } = require('./_sections');
const { isDatacenterIP } = require('./_bot-filter');

const VALID_IDS = new Set(SECTIONS.map((s) => s.id));
const VALID_QUIZ_IDS = new Set(QUIZ_STEPS.map((s) => s.id));
const MAX_INDIVIDUALS = 500; // limite pra não crescer sem fim

function detectDevice(ua) {
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobile|iPhone|Android/i.test(ua)) return 'mobile';
  return 'desktop';
}
function detectPlatform(ua) {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS/i.test(ua)) return 'Mac';
  return 'Other';
}
// Onde a página abriu. Cruzado com a plataforma, é o corte que separa "iOS vai
// mal" de "webview do Instagram vai mal" — sem ele, um problema que só existe
// dentro do app fica escondido dentro do número do iPhone inteiro.
function detectBrowserEnv(ua) {
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook';
  if (/CriOS/i.test(ua)) return 'chrome-ios';
  if (/wv\)/.test(ua)) return 'android-webview';
  return 'browser';
}
// % e + entram na lista permitida de propósito: o utm_content chega
// percent-encoded ("Organico1+-+Cal%C3%A7a+Cinza") e, se destruirmos a
// codificação aqui, o nome do criativo fica ilegível pra sempre no painel.
// Quem decodifica é o funnel-data (e ele limpa o que sobra do decode).
function cleanAdRef(v) {
  // \p{L}\p{N} em vez de \w: com \w um nome que chega SEM encoding perdia os
  // acentos ("Calça" virava "Cala"), e aí o mesmo criativo aparecia escrito de
  // dois jeitos no painel. Continua barrando < > " ' &, que é o que importa.
  const s = String(v || '').replace(/[^\p{L}\p{N}\s\-.|:/%+_]/gu, '').trim().slice(0, 120);
  return s || 'Sem anúncio';
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  try {
    const body = await readBody(req);
    const visitorId = String(body.visitorId || '').slice(0, 64);
    const section = String(body.section || '');
    let maxSection = String(body.maxSection || '');
    if (!VALID_IDS.has(maxSection)) maxSection = section;

    // Batida vinda do /quiz.html: trilha separada da página (ver QUIZ_STEPS).
    const quizStep = String(body.quizStep || '');
    let quizMax = String(body.quizMax || '');
    if (!VALID_QUIZ_IDS.has(quizMax)) quizMax = quizStep;
    const isQuizBeat = VALID_QUIZ_IDS.has(quizStep);

    if (!visitorId || (!VALID_IDS.has(section) && !isQuizBeat)) {
      return res.status(200).json({ ok: false });
    }

    const ua = req.headers['user-agent'] || '';
    const device = detectDevice(ua);
    const platform = detectPlatform(ua);
    const browserEnv = detectBrowserEnv(ua);
    const adRef = cleanAdRef(body.adRef);
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'Sem dado';
    const now = Date.now();

    // Robôs de datacenter (crawler de revisão de anúncio, scanners de segurança
    // batendo em domínio novo) não são visitante de verdade — nem grava, pra
    // não poluir o painel. Responde ok:true mesmo assim (não é erro do front).
    if (isDatacenterIP(ip)) {
      return res.status(200).json({ ok: true, skipped: 'datacenter-ip' });
    }

    // A batida do quiz só mexe nos campos do quiz; a da página só nos da página.
    // Assim um visitante que fez o quiz e depois foi pra página acumula as duas
    // trilhas no mesmo hash, sem uma sobrescrever a outra.
    const progress = isQuizBeat
      ? ['HSET', `visitor:${visitorId}`, 'quizStep', quizStep, 'quizMax', quizMax, 'lastSeen', String(now), 'device', device, 'platform', platform, 'browserEnv', browserEnv]
      : ['HSET', `visitor:${visitorId}`, 'lastSection', section, 'maxSection', maxSection, 'lastSeen', String(now), 'device', device, 'platform', platform, 'browserEnv', browserEnv];

    const cmds = [
      ['SET', `presence:${visitorId}`, isQuizBeat ? `quiz:${quizStep}` : section, 'EX', 45],
      progress,
      // Campos "first-touch": só gravam na primeira vez.
      ['HSETNX', `visitor:${visitorId}`, 'firstSeen', String(now)],
      ['HSETNX', `visitor:${visitorId}`, 'adRef', adRef],
      ['HSETNX', `visitor:${visitorId}`, 'ip', ip],
      ['ZADD', 'individuals', now, visitorId],
      ['ZREMRANGEBYRANK', 'individuals', 0, -(MAX_INDIVIDUALS + 1)],
    ];

    // Sinais de ENTRADA (só sobem, nunca voltam pra 0). Separam "a página nasceu
    // em segundo plano e ninguém viu" de "alguém viu e não quis" — sem eles, as
    // duas coisas ficam idênticas no painel e o abandono do topo parece maior.
    if (body.hiddenLoad) cmds.push(['HSETNX', `visitor:${visitorId}`, 'hiddenLoad', '1']);
    if (body.visible)    cmds.push(['HSET',   `visitor:${visitorId}`, 'visible', '1']);
    if (body.touched)    cmds.push(['HSET',   `visitor:${visitorId}`, 'touched', '1']);

    await redisPipeline(cmds);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('presence error', err);
    return res.status(200).json({ ok: false });
  }
};
