// Preco na moeda da mae: devolve o pais (IP, pela Vercel) e o fator que a pagina aplica em cada
// valor em US$. So exibicao: a Hotmart continua cobrando em USD e convertendo do jeito dela.
//
// MEDIDO, nao calculado (02/11/2026): abri os dois checkouts (?checkoutMode=10), troquei o pais
// no "Alterar pais" e li o "Total de". MULT = esse total / (preco USD x cambio do dia). Ele embute
// o spread de cambio da Hotmart e o imposto que ela cobra em cada pais (no Mesa a Mesa o imposto
// ja vem dentro do preco, por isso o Chile fica em +6% e nao nos +24% do NutriPlan).
// Totais do Completo (US$ 9.90): MX 228,52 · CO 33.050 · AR 18.014 · PE 37 · CL 10.372.
// EC e PR pagam US$ exato e ficam em dolar. Pais fora da tabela: dolar.
//
// O valor mostrado e sempre ARREDONDADO PRA CIMA com folga (BUF), entao no checkout ela ve
// igual ou menos, nunca mais. Remedir se a Hotmart mudar imposto ou se o preco mudar.
const PAISES = {
  MX: { moeda: 'MXN', mult: 1.228, passo: 1, loc: 'es-MX' },
  CO: { moeda: 'COP', mult: 1.046, passo: 100, loc: 'es-CO' },
  AR: { moeda: 'ARS', mult: 1.184, passo: 100, loc: 'es-AR', buf: 1.04 }, // peso argentino oscila mais
  PE: { moeda: 'PEN', mult: 1.078, passo: 1, loc: 'es-PE', simbolo: 'S/ ' },
  CL: { moeda: 'CLP', mult: 1.057, passo: 100, loc: 'es-CL' },
};
const BUF = 1.02; // cambio do dia (open.er-api) x cambio que a Hotmart usa na hora da compra

let cache = { t: 0, r: null };
async function cambio() {
  if (cache.r && Date.now() - cache.t < 6 * 3600e3) return cache.r;
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 2500);
  try {
    const j = await (await fetch('https://open.er-api.com/v6/latest/USD', { signal: c.signal })).json();
    if (j && j.rates) cache = { t: Date.now(), r: j.rates };
  } catch (e) { /* sem cambio a pagina fica em dolar */ } finally { clearTimeout(t); }
  return cache.r;
}

module.exports = async (req, res) => {
  const q = new URL(req.url, 'http://x').searchParams;
  // ?pais=MX so para testar a pagina como se fosse de outro pais
  const pais = String(q.get('pais') || req.headers['x-vercel-ip-country'] || '').toUpperCase().slice(0, 2);
  res.setHeader('Cache-Control', 'private, max-age=1800');
  const cfg = PAISES[pais]; const r = cfg ? await cambio() : null;
  if (!cfg || !r || !r[cfg.moeda]) return res.status(200).json({ pais, moeda: 'USD' });
  return res.status(200).json({
    pais, moeda: cfg.moeda, loc: cfg.loc, passo: cfg.passo, simbolo: cfg.simbolo || '$',
    fator: r[cfg.moeda] * cfg.mult * (cfg.buf || BUF),
  });
};
