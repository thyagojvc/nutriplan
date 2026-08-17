// POST /api/delete-visitors  { key, visitorIds: [...] }
// Apaga sessões do painel: teste seu, bot que passou pelo filtro, lead falso.
// Protegido pela MESMA chave do painel (FUNNEL_DASHBOARD_KEY) — quem já entrou
// no /funil não precisa de um segundo segredo.
//
// REGRA DELIBERADA: só apaga os ids que vierem na lista. Não existe "apagar
// tudo" aqui, e nem deve existir. Já aconteceu de uma limpeza cega levar junto
// sessões reais vindas de anúncio, e não dá pra recuperar: os dados moram só
// no Redis, sem backup. Se um dia precisar zerar tudo, é seleção explícita no
// painel, ciente do que está indo embora.

const { redisPipeline } = require('./_kv');

const MAX_POR_VEZ = 200; // trava de segurança contra um payload absurdo

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
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const body = await readBody(req);

    if (!process.env.FUNNEL_DASHBOARD_KEY || body.key !== process.env.FUNNEL_DASHBOARD_KEY) {
      return res.status(401).json({ error: 'Chave inválida' });
    }

    const ids = Array.isArray(body.visitorIds) ? body.visitorIds : [];
    // O id vira parte do nome da chave no Redis, então só aceita o formato que
    // o próprio site gera (uuid ou v_<algo>). Sem isso, um id com caractere
    // esquisito poderia apontar pra uma chave que não é de visitante.
    const limpos = ids
      .map((id) => String(id || '').trim())
      .filter((id) => id && id.length <= 64 && /^[\w-]+$/.test(id))
      .slice(0, MAX_POR_VEZ);

    if (!limpos.length) {
      return res.status(400).json({ error: 'Nenhum id válido na lista' });
    }

    const cmds = [];
    for (const id of limpos) {
      cmds.push(['DEL', `visitor:${id}`]);
      cmds.push(['DEL', `presence:${id}`]);
      cmds.push(['ZREM', 'individuals', id]);
    }
    await redisPipeline(cmds);

    return res.status(200).json({ ok: true, deleted: limpos.length });
  } catch (err) {
    console.error('delete-visitors error', err);
    return res.status(500).json({ error: 'Erro ao apagar as sessões' });
  }
};
