// POST /api/f  ·  Batida do funil da landing (mesma ideia do presence.js do KPL).
// A pagina chama ao abrir, quando passa de secao e a cada ~15 s enquanto a aba esta visivel
// (no maximo 10 min). Corpo (text/plain JSON, via sendBeacon):
//   { s: sessao, d: 'AAAAMMDD', p: secao mais funda, c: secao atual, o: origem,
//     a: anuncio, cp: campanha, cj: conjunto, pl: plano clicado }
// Redis (banco KPL do Upstash, chaves mam:*), 2 comandos por batida num pipeline so:
//   mam:fun:<AAAAMMDD>  hash  sessao -> JSON com tudo da visita (expira em 90 dias)
//   mam:on              zset  sessao -> hora da ultima batida ("ao vivo" = ultimos 40 s)
// Dispositivo, sistema, navegador e IP vem do request (o front nunca manda isso).
const ipDaMeta = require('./_meta-ip');
const MAX_ETAPA = 16; // 1..15 secoes da pagina, 16 = clicou no checkout; 17 = compra (webhook)

async function pipeline(cmds) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL + '/pipeline', {
    method: 'POST', headers: { Authorization: 'Bearer ' + process.env.UPSTASH_REDIS_REST_TOKEN }, body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('Upstash ' + r.status);
  return r.json();
}
// % e + continuam: o utm chega percent-encoded e quem decodifica e o painel
const limpa = (x, n) => String(x || '').replace(/[<>"'&\r\n]/g, ' ').slice(0, n);

function ambiente(ua) {
  const dv = /iPad|Tablet/i.test(ua) ? 'Tablet' : /Mobi|iPhone|Android/i.test(ua) ? 'Celular' : 'Computador';
  const so = /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'Mac' : 'Outro';
  // Onde a pagina abriu: separa "iOS vai mal" de "navegador do Instagram vai mal"
  const nav = /Instagram/i.test(ua) ? 'App do Instagram' : /FBAN|FBAV|FB_IAB/i.test(ua) ? 'App do Facebook'
    : /CriOS|Chrome/i.test(ua) && !/Edg/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : /Firefox/i.test(ua) ? 'Firefox' : /Edg/i.test(ua) ? 'Edge' : 'Outro';
  return { dv, so, nav };
}

// PageView tambem pela API de Conversoes (servidor), com o MESMO event_id do pixel: o Meta
// deduplica e conta 1. Pega quem sai antes do pixel carregar ou tem rastreamento bloqueado
// no iPhone. Token em META_CAPI_TOKEN (variavel da Vercel, nunca no codigo).
// Desde 21/10/2026 a pagina das maes (l: 'madres') tem pixel proprio, com token em
// META_CAPI_TOKEN_MADRES; /profesional e /latam seguem no pixel do profissional.
// A pagina das maes LatAm (/familias, l: 'familias', 29/10/2026) usa o mesmo pixel das maes.
const PIXEL = '1113787607687773';
const PIXEL_MADRES = '1845583283279133';
async function pageViewServidor(req, b) {
  const madres = b.l === 'madres' || b.l === 'familias';
  const pixel = madres ? PIXEL_MADRES : PIXEL;
  const token = madres ? process.env.META_CAPI_TOKEN_MADRES : process.env.META_CAPI_TOKEN;
  const pv = String(b.pv || '');
  if (!token || !/^pv_[a-z0-9]{6,30}$/.test(pv)) return;
  const cookies = Object.fromEntries(String(req.headers.cookie || '').split(/;\s*/).map((c) => c.split('=')).filter((x) => x[0]));
  let url = ''; try { url = new URL(String(b.u || '')).toString(); } catch (e) { /* sem url */ }
  let fbc = cookies._fbc;
  if (!fbc && url) { const id = new URL(url).searchParams.get('fbclid'); if (id) fbc = 'fb.1.' + Date.now() + '.' + id; }
  const user = {
    client_ip_address: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || undefined,
    client_user_agent: req.headers['user-agent'] || undefined,
    fbp: cookies._fbp || undefined, fbc: fbc || undefined,
  };
  const evento = { event_name: 'PageView', event_time: Math.floor(Date.now() / 1000), event_id: pv, action_source: 'website', event_source_url: url || undefined, user_data: user };
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: [evento] }), signal: ctrl.signal,
    });
    // aparece em "vercel logs": events_received 1 = o Meta recebeu
    console.log('capi PageView', madres ? 'madres' : 'pro', r.status, (await r.text()).slice(0, 160));
  } catch (e) { /* Meta fora do ar nao pode atrasar nem quebrar a pagina */ } finally { clearTimeout(t); }
}

async function corpo(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (b && typeof b === 'object') return b;
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return {}; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const ua = req.headers['user-agent'] || '';
  if (/bot|crawl|spider|facebookexternalhit|headless|preview/i.test(ua)) return res.status(204).end();
  // robo de revisao da Meta: nao entra no funil nem manda PageView pelo servidor
  if (ipDaMeta(String(req.headers['x-forwarded-for'] || '').split(',')[0])) return res.status(204).end();
  const b = await corpo(req);
  const s = String(b.s || ''); const d = String(b.d || ''); const p = Number(b.p); const c = Number(b.c) || p;
  if (!/^[a-z0-9]{8,20}$/.test(s) || !/^\d{8}$/.test(d) || !(p >= 1 && p <= MAX_ETAPA)) return res.status(204).end();
  const agora = Date.now();
  const v = {
    p, c, l: ['latam', 'madres', 'familias'].includes(b.l) ? b.l : 'es', o: limpa(b.o, 60), a: limpa(b.a, 120), cp: limpa(b.cp, 120), cj: limpa(b.cj, 120), pl: limpa(b.pl, 10),
    ...ambiente(ua), ip: String(req.headers['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 45),
    t0: Number(b.t0) || agora, t1: agora,
  };
  const capi = b.pv ? pageViewServidor(req, b) : null;
  try {
    await pipeline([
      ['HSET', 'mam:fun:' + d, s, JSON.stringify(v)],
      ['ZADD', 'mam:on', agora, s + '|' + d],
      ...(Number(b.n) === 1 ? [['EXPIRE', 'mam:fun:' + d, 60 * 60 * 24 * 90]] : []),
    ]);
  } catch (e) { /* funil nunca pode quebrar a pagina */ }
  if (capi) await capi;
  return res.status(204).end();
};
