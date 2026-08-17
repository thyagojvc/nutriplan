// Kit Prato Limpo — Meta Conversions API (server-side), no mesmo espírito do
// fb-conversions-api.ts do NutriPlan: espelha os eventos do pixel do navegador
// com melhor match quality (IP, user-agent, fbc/fbp confiáveis) e garante o
// Purchase mesmo quando o pixel é bloqueado por adblock/iOS.

const crypto = require('crypto');

const PIXEL_ID = '2794485957574762';
const API_URL = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value).toLowerCase().trim()).digest('hex');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (k) out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

/** _fbc pode faltar (adblock) mas se veio fbclid na URL dá pra reconstruir. */
function resolveFbc(cookies, fbclid) {
  if (cookies._fbc) return cookies._fbc;
  if (fbclid) return `fb.1.${Date.now()}.${fbclid}`;
  return null;
}

async function postToMeta(events) {
  const token = process.env.FB_CONVERSIONS_API_TOKEN;
  if (!token) return;
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: events, access_token: token }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      console.error('[fb-capi] falhou', r.status, text);
    }
  } catch (err) {
    console.error('[fb-capi] erro de rede', err);
  }
}

/** Espelha um evento de funil (mesmo event_id do pixel client-side, pro Meta desduplicar). */
async function sendCapiEvent({ eventName, eventId, fbc, fbp, clientUserAgent, clientIpAddress, customData }) {
  const userData = {};
  if (fbc) userData.fbc = fbc;
  if (fbp) userData.fbp = fbp;
  if (clientIpAddress) userData.client_ip_address = clientIpAddress;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;

  // Sem nenhum identificador útil não vale a pena gastar a chamada.
  if (Object.keys(userData).length === 0) return;

  await postToMeta([
    {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      user_data: userData,
      ...(customData && Object.keys(customData).length ? { custom_data: customData } : {}),
    },
  ]);
}

/**
 * Purchase com dados completos (e-mail, telefone, nome hasheados) — o evento mais
 * importante. event_id = purchase_<paymentId>, igual ao que o pixel client-side usa
 * em onPaid(), pro Meta desduplicar em vez de contar a venda duas vezes.
 */
async function sendCapiPurchase({ paymentId, email, name, phone, valueCents, fbc, fbp, clientUserAgent, clientIpAddress, eventTime }) {
  const userData = {};
  if (email) userData.em = [sha256(email)];
  if (phone) userData.ph = [sha256(String(phone).replace(/\D/g, ''))];
  if (name) {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts[0]) userData.fn = [sha256(parts[0])];
    if (parts.length > 1) userData.ln = [sha256(parts[parts.length - 1])];
  }
  if (fbc) userData.fbc = fbc;
  if (fbp) userData.fbp = fbp;
  if (clientIpAddress) userData.client_ip_address = clientIpAddress;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;

  // O Meta REJEITA (HTTP 400, subcode 2804050) evento sem nenhum dado de
  // cliente. Sem este aviso a venda sumia calada: a chamada saía, voltava erro,
  // e o `.catch()` de quem chama engolia tudo — o Purchase nunca era contado e
  // nada aparecia como problema. Se cair aqui, o dado que falta é upstream
  // (backup do checkout não encontrado), e é isso que precisa ser investigado.
  if (Object.keys(userData).length === 0) {
    console.error(`[fb-capi] Purchase ${paymentId} SEM dado de cliente: o Meta rejeitaria. Venda NÃO reportada.`);
    return;
  }

  await postToMeta([
    {
      event_name: 'Purchase',
      event_time: eventTime || Math.floor(Date.now() / 1000),
      event_id: `purchase_${paymentId}`,
      action_source: 'website',
      user_data: userData,
      custom_data: {
        value: (valueCents || 0) / 100,
        currency: 'BRL',
        content_name: 'Kit Prato Limpo',
      },
    },
  ]);
}

module.exports = { sendCapiEvent, sendCapiPurchase, parseCookies, resolveFbc };
