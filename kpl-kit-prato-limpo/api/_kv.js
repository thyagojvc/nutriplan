// Helper mínimo pro Redis da Upstash (via REST, sem SDK) — usado pelo painel
// de presença ao vivo (api/presence.js, api/funnel-data.js).
// Variáveis de ambiente: KV_REST_API_URL, KV_REST_API_TOKEN (injetadas pela
// integração Upstash conectada ao projeto na Vercel).

async function redis(...args) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV não configurado (KV_REST_API_URL/KV_REST_API_TOKEN ausentes)');

  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Redis ${args[0]} falhou: ${r.status} ${text}`);
  }
  const json = await r.json();
  return json.result;
}

// Pipeline: várias operações num POST só (menos round-trips).
async function redisPipeline(commands) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('KV não configurado (KV_REST_API_URL/KV_REST_API_TOKEN ausentes)');

  const r = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Redis pipeline falhou: ${r.status} ${text}`);
  }
  const json = await r.json();
  return json.map((item) => item.result);
}

module.exports = { redis, redisPipeline };
