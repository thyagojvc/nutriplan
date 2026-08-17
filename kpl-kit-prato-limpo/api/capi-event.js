// POST /api/capi-event
// Espelha os eventos de funil do pixel (client-side) também pela Conversions API
// (server-side): melhor match quality (fbc/fbp, IP, user-agent confiáveis) e
// sobrevive a adblock/iOS que bloqueiam o pixel do navegador.
//
// O event_id chega do cliente e é o MESMO usado no fbq(...), então o Meta
// desduplica pelo par (event_name, event_id) e não conta o evento em dobro.
// Só aceita a lista fixa de eventos do funil, nunca um nome arbitrário.
// Fire-and-forget: sempre responde 200, não deve travar a navegação do front.

const { sendCapiEvent, parseCookies, resolveFbc } = require('./_fb-capi');

const FUNNEL_EVENTS = [
  'ViewContent', 'FormStart', 'InitiateCheckout', 'ViewSection',
  'BumpToggle', 'AddPaymentInfo', 'PixCodeCopied', 'FAQOpen',
];

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
    const eventName = String(body.event_name || '');
    const eventId = String(body.event_id || '').slice(0, 100);
    const customData = body.data && typeof body.data === 'object' ? body.data : {};
    const fbclid = body.fbclid ? String(body.fbclid).slice(0, 500) : null;

    if (!FUNNEL_EVENTS.includes(eventName) || !eventId) {
      return res.status(200).json({ ok: false });
    }

    const cookies = parseCookies(req);
    const fbc = resolveFbc(cookies, fbclid);
    const fbp = cookies._fbp || null;
    const clientUserAgent = req.headers['user-agent'] || null;
    const clientIpAddress = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;

    // Espera o envio pro Meta terminar antes de responder: em função serverless,
    // devolver a resposta antes pode matar a invocação com o fetch ainda em voo.
    await sendCapiEvent({ eventName, eventId, fbc, fbp, clientUserAgent, clientIpAddress, customData })
      .catch((err) => console.error('capi-event dispatch error', err));

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('capi-event fatal', err);
    return res.status(200).json({ ok: false });
  }
};
