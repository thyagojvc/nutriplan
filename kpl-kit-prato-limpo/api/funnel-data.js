// GET /api/funnel-data?key=<FUNNEL_DASHBOARD_KEY>&range=today|7d|30d|all
// Alimenta o painel em /funil.html. Tudo é derivado dos visitantes recentes
// (sorted set `individuals` + hash de cada um) e filtrável por período:
//   - ao vivo agora, funil de abandono (por seção mais profunda alcançada),
//   - criativos (anúncio de origem), dispositivo, sistema,
//   - vendas (sorted set `kpl:sales`, gravado no deliver-kit).
// Protegido por chave compartilhada. Não expõe e-mail/CPF, só ids anônimos,
// contagens e o primeiro nome de quem comprou.

const { redis, redisPipeline } = require('./_kv');
const { SECTIONS, QUIZ_STEPS, PRO_STEPS } = require('./_sections');

const MAX = 100;
// O painel fica aberto e recalcula o funil inteiro (pipeline de até 2×MAX
// leituras) a cada poll do front. Sem isso, deixar a aba aberta por um dia
// sozinha estourava as 500 mil requisições/mês do plano free do Redis
// (14/08: 984 mil de 500 mil, quase tudo leitura; 200-245 mil/dia nos dois
// dias seguintes com o painel aberto). Cache de resposta pronta por período:
// enquanto ninguém muda de período, praticamente todo poll vira 1 leitura em
// vez de ~2×MAX+2. TTL tem que ser MAIOR que o intervalo de poll do
// funil.html (30s) — com TTL menor que o intervalo, o cache expira antes do
// próximo poll chegar e nunca é reaproveitado (foi o que aconteceu com 12s
// de TTL vs 20s de poll, praticamente não economizava nada na prática).
const CACHE_TTL_SECONDS = 60;

function computeSince(range, now) {
  if (range === '7d') return now - 7 * 86400000;
  if (range === '30d') return now - 30 * 86400000;
  if (range === 'today') {
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(now));
    const t = Date.parse(`${dateStr}T00:00:00-03:00`);
    return Number.isNaN(t) ? 0 : t;
  }
  return 0; // 'all'
}

function groupCount(rows, field) {
  const map = {};
  for (const r of rows) {
    const k = r[field] || '—';
    map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

// O utm_content chega como veio na URL, então um nome de anúncio com espaço ou
// acento aparece percent-encoded ("Organico1+-+Cal%C3%A7a+Cinza"). Sem decodificar,
// o MESMO criativo vira duas linhas no painel e a leitura por anúncio racha.
// '+' vira espaço (codificação de formulário) antes do decode.
function decodeRef(raw) {
  if (!raw) return '';
  let out;
  try {
    out = decodeURIComponent(String(raw).replace(/\+/g, ' '));
  } catch (e) {
    out = String(raw); // sequência percent inválida: mostra cru em vez de quebrar o painel
  }
  // O decode pode RESSUSCITAR caracteres que o cleanAdRef tinha barrado na
  // gravação (%3C vira "<"), e esse texto vai parar no HTML do painel. Tira de
  // novo o que serve pra montar tag/atributo.
  return out.replace(/[<>"'&]/g, '').trim();
}

function decodeAdRef(raw) {
  return decodeRef(raw) || 'Sem anúncio';
}

// MESMA PESSOA, VARIAS SESSOES (18/09). O id do visitante mora no
// sessionStorage, e o navegador do Instagram abre uma sessao nova a cada toque
// no anuncio: quem abre tres vezes vira tres visitantes, e o funil infla.
//
// Aqui junta, SO NA LEITURA, sessoes com o mesmo IP e o mesmo anuncio em que
// uma comeca ate 30 min depois da anterior terminar. Nada muda no Redis (sem
// comando novo, e vale pro historico todo). Fica a parte mais funda que a
// pessoa alcancou em qualquer uma das aberturas.
//
// Risco conhecido: operadora de celular as vezes poe varias pessoas atras do
// mesmo IP (CGNAT). Exigir o mesmo anuncio e a janela curta deixa isso raro.
// IP "Sem dado" nunca junta.
const JANELA_MESMA_PESSOA_MS = 30 * 60 * 1000;

function juntarMesmaPessoa(rows, idxOf) {
  const quizIdx = {};
  QUIZ_STEPS.forEach((s, i) => { quizIdx[s.id] = i; });
  const proIdx = {};
  PRO_STEPS.forEach((s, i) => { proIdx[s.id] = i; });
  const fundo = (a, b, idx) => ((idx[b] ?? -1) > (idx[a] ?? -1) ? b : a);

  const ordem = rows.slice().sort((a, b) => (a.firstSeen || 0) - (b.firstSeen || 0));
  const aberto = {}; // chave -> grupo em andamento
  const saida = [];

  for (const v of ordem) {
    const chave = v.ip && v.ip !== 'Sem dado' ? v.ip + '|' + v.adRef : null;
    const g = chave && aberto[chave];
    if (g && (v.firstSeen || 0) - (g.lastSeen || 0) <= JANELA_MESMA_PESSOA_MS) {
      g.ids.push(v.id);
      g.firstSeen = Math.min(g.firstSeen || v.firstSeen, v.firstSeen || g.firstSeen);
      if ((v.lastSeen || 0) >= (g.lastSeen || 0)) {
        // Dados de ambiente vêm da abertura mais recente.
        Object.assign(g, {
          id: v.id, lastSeen: v.lastSeen, lastSection: v.lastSection,
          device: v.device || g.device, platform: v.platform || g.platform,
          browserEnv: v.browserEnv || g.browserEnv,
          campaign: v.campaign || g.campaign, adset: v.adset || g.adset,
        });
      }
      g.maxSection = fundo(g.maxSection, v.maxSection, idxOf);
      g.quizMax = fundo(g.quizMax, v.quizMax, quizIdx);
      g.proMax = fundo(g.proMax, v.proMax, proIdx);
      g.hiddenLoad = g.hiddenLoad && v.hiddenLoad;
      g.visible = g.visible || v.visible;
      g.touched = g.touched || v.touched;
      g.checkoutStarted = g.checkoutStarted || v.checkoutStarted;
      g.isLive = g.isLive || v.isLive;
      continue;
    }
    const novo = Object.assign({}, v, { ids: [v.id] });
    if (chave) aberto[chave] = novo;
    saida.push(novo);
  }

  // Mesma ordem de antes: mais recente primeiro.
  return saida.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
}

// O visitante guarda anúncio, campanha e conjunto num campo só ("a~c~s"), pra
// não custar dois comandos a mais do Upstash em cada batida (ver presence.js).
// Visitante gravado antes de 16/09 não tem "~": vira só o anúncio, e campanha e
// conjunto ficam null, igual às vendas antigas.
// Separa ANTES de decodificar, pra um valor que chegue com %7E não virar um
// separador extra e deslocar os campos.
function splitVisitorRef(raw) {
  const parts = String(raw || '').split('~');
  const campaign = decodeRef(parts[1]);
  return {
    adRef: decodeAdRef(parts[0]),
    // Mesma regra das vendas: com a campanha já nomeada, o ID do conjunto só
    // polui a coluna.
    campaign: campaign ? (CAMPAIGN_NAMES[campaign] || campaign) : null,
    adset: campaign && CAMPAIGN_NAMES[campaign] ? null : (decodeRef(parts[2]) || null),
  };
}

const BROWSER_ENV_LABELS = {
  instagram: 'Instagram in-app',
  facebook: 'Facebook in-app',
  'chrome-ios': 'Chrome iOS',
  'android-webview': 'WebView Android',
  browser: 'Navegador',
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const url = new URL(req.url, 'http://x');
  const key = (req.query && req.query.key) || url.searchParams.get('key');
  if (!process.env.FUNNEL_DASHBOARD_KEY || key !== process.env.FUNNEL_DASHBOARD_KEY) {
    return res.status(401).json({ error: 'Chave inválida' });
  }

  const range = ((req.query && req.query.range) || url.searchParams.get('range') || 'all').toLowerCase();
  const now = Date.now();
  const sinceTs = computeSince(range, now);
  const cacheKey = `funnel-cache:${range}`;

  try {
    const cached = await redis('GET', cacheKey);
    if (cached) return res.status(200).json(JSON.parse(cached));
  } catch (err) {
    // Cache indisponível não pode travar o painel: segue pro cálculo normal.
    console.error('funnel-data cache read error', err);
  }

  try {
    const ids = await redis('ZREVRANGE', 'individuals', 0, MAX - 1);
    const idList = Array.isArray(ids) ? ids : [];

    const hashes = idList.length
      ? await redisPipeline(idList.map((id) => ['HGETALL', `visitor:${id}`]))
      : [];
    const presence = idList.length
      ? await redisPipeline(idList.map((id) => ['GET', `presence:${id}`]))
      : [];

    const idxOf = {};
    SECTIONS.forEach((s, i) => { idxOf[s.id] = i; });

    const all = idList.map((id, i) => {
      const h = arrToObj(hashes[i]);
      return {
        id,
        firstSeen: h.firstSeen ? Number(h.firstSeen) : null,
        lastSeen: h.lastSeen ? Number(h.lastSeen) : null,
        lastSection: h.lastSection || null,
        maxSection: h.maxSection || h.lastSection || null,
        quizMax: h.quizMax || h.quizStep || null,
        proMax: h.proMax || h.proStep || null,
        device: h.device || null,
        platform: h.platform || null,
        browserEnv: h.browserEnv || null,
        ...splitVisitorRef(h.adRef),
        ip: h.ip || 'Sem dado',
        hiddenLoad: h.hiddenLoad === '1',
        visible: h.visible === '1',
        touched: h.touched === '1',
        checkoutStarted: h.checkoutStarted === '1',
        isLive: !!presence[i],
      };
    });

    const noPeriodo = range === 'all'
      ? all
      : all.filter((v) => v.lastSeen && v.lastSeen >= sinceTs);
    const rows = juntarMesmaPessoa(noPeriodo, idxOf);

    const liveCount = rows.filter((v) => v.isLive).length;

    // Funil: quantos alcançaram (pelo menos) cada seção, via maxSection.
    const sections = SECTIONS.map((s, i) => ({
      id: s.id,
      label: s.label,
      count: rows.filter((v) => v.maxSection != null && (idxOf[v.maxSection] ?? -1) >= i).length,
    }));

    // Funil do QUIZ: contado só entre quem realmente entrou no quiz (tem quizMax).
    // Se somasse todo mundo, quem caiu direto no index apareceria como se tivesse
    // passado pelas perguntas.
    const quizIdxOf = {};
    QUIZ_STEPS.forEach((s, i) => { quizIdxOf[s.id] = i; });
    const quizRows = rows.filter((v) => v.quizMax && quizIdxOf[v.quizMax] != null);
    const quizSections = QUIZ_STEPS.map((s, i) => ({
      id: s.id,
      label: s.label,
      count: quizRows.filter((v) => (quizIdxOf[v.quizMax] ?? -1) >= i).length,
    }));

    // Funil da EDIÇÃO PROFISSIONAL: só entre quem passou pela /profissional
    // (tem proMax). Página, público e preço são outros, então some junto com o
    // funil das mães daria número sem significado.
    const proIdxOf = {};
    PRO_STEPS.forEach((s, i) => { proIdxOf[s.id] = i; });
    const proRows = rows.filter((v) => v.proMax && proIdxOf[v.proMax] != null);
    const proSections = PRO_STEPS.map((s, i) => ({
      id: s.id,
      label: s.label,
      count: proRows.filter((v) => (proIdxOf[v.proMax] ?? -1) >= i).length,
    }));
    // Por anúncio, DENTRO da edição profissional: é o corte que diz qual
    // criativo traz nutricionista que chega no Pix, e não só clique.
    const proCreatives = groupCount(proRows, 'adRef').map((c) => Object.assign({}, c, {
      pix: proRows.filter((v) => v.adRef === c.key && (proIdxOf[v.proMax] ?? -1) >= proIdxOf.p_pix).length,
      checkout: proRows.filter((v) => v.adRef === c.key && (proIdxOf[v.proMax] ?? -1) >= proIdxOf.p_checkout).length,
    }));

    const creatives = groupCount(rows, 'adRef');
    const devices = groupCount(rows, 'device');
    const platforms = groupCount(rows, 'platform');

    // ENTRADA: o trecho antes de a pessoa se engajar, que o funil por seção não
    // enxerga (ele usa quem já está na página como 100%). É aqui que some a
    // maior parte do tráfego pago.
    const engagedOf = (v) => (idxOf[v.maxSection] ?? -1) >= 1 || !!v.quizMax || (proIdxOf[v.proMax] ?? -1) >= 1;
    const entrada = [
      { key: 'visitas',  label: 'Visitas registradas', hint: 'bateu no site e o rastreamento rodou', count: rows.length },
      { key: 'fantasma', label: 'Carga fantasma',      hint: 'página nasceu em segundo plano (preload do in-app)', count: rows.filter((v) => v.hiddenLoad).length },
      { key: 'visivel',  label: 'Página ficou visível', hint: 'alguém de fato viu a tela', count: rows.filter((v) => v.visible).length },
      { key: 'tocou',    label: 'Tocou na tela',        hint: 'primeiro toque ou tecla', count: rows.filter((v) => v.touched).length },
      { key: 'engajou',  label: 'Passou do topo',       hint: 'rolou além do hero (ou entrou no quiz)', count: rows.filter(engagedOf).length },
    ];

    // AMBIENTE: plataforma cruzada com onde a página abriu. É o corte que revela
    // problema de webview in-app; sem ele, "iOS vai mal" esconde que o problema
    // pode ser só dentro do app, e não no Safari.
    const envMap = {};
    for (const v of rows) {
      const env = v.browserEnv ? (BROWSER_ENV_LABELS[v.browserEnv] || v.browserEnv) : 'Sem dado';
      const key = `${v.platform || 'Sem dado'} · ${env}`;
      envMap[key] ??= { key, total: 0, engaged: 0 };
      envMap[key].total += 1;
      if (engagedOf(v)) envMap[key].engaged += 1;
    }
    const browserEnvs = Object.values(envMap).sort((a, b) => b.total - a.total);

    // ÚLTIMOS ACESSOS: pulso ao vivo. `rows` já vem ordenado do mais recente
    // pro mais antigo (ZREVRANGE), então basta cortar os primeiros.
    const lastVisits = rows.slice(0, 5).map((v) => ({
      id: v.id,
      firstSeen: v.firstSeen,
      adRef: v.adRef,
      platform: v.platform,
      browserEnv: v.browserEnv ? (BROWSER_ENV_LABELS[v.browserEnv] || v.browserEnv) : null,
      maxSection: v.maxSection,
      quizMax: v.quizMax,
      proMax: v.proMax,
      isLive: v.isLive,
    }));

    // INICIARAM CHECKOUT: nome preenchido + avançou pro e-mail (sinal mais forte
    // que só ter rolado até a seção). `rows` já vem do mais recente pro mais
    // antigo, então os primeiros 30 já são os mais recentes.
    const checkoutStarts = rows.filter((v) => v.checkoutStarted).slice(0, 30).map((v) => ({
      id: v.id,
      lastSeen: v.lastSeen,
      adRef: v.adRef,
      platform: v.platform,
      browserEnv: v.browserEnv ? (BROWSER_ENV_LABELS[v.browserEnv] || v.browserEnv) : null,
      maxSection: v.maxSection,
      isLive: v.isLive,
    }));
    const checkoutStartedCount = rows.filter((v) => v.checkoutStarted).length;

    // Vendas (member = JSON, score = timestamp). Filtra pelo período.
    const salesRaw = await redis('ZREVRANGE', 'kpl:sales', 0, 199, 'WITHSCORES');
    const sales = parseSales(salesRaw)
      .filter((s) => range === 'all' || s.ts >= sinceTs)
      .slice(0, 50);
    const revenueCents = sales.reduce((acc, s) => acc + (s.valueCents || 0), 0);
    // Sai do array de vendas que ja foi lido acima: nenhuma leitura nova no
    // Redis. groupCount ja transforma null em '—', que o painel rotula.
    const salesPlatforms = groupCount(sales, 'platform');

    const payload = {
      now,
      range,
      liveCount,
      total: rows.length,
      sections,
      quizSections,
      quizTotal: quizRows.length,
      proSections,
      proTotal: proRows.length,
      proCreatives,
      entrada,
      browserEnvs,
      lastVisits,
      checkoutStarts,
      checkoutStartedCount,
      creatives,
      devices,
      platforms,
      sales,
      salesCount: sales.length,
      salesPlatforms,
      revenueCents,
      individuals: rows,
    };

    try {
      await redis('SET', cacheKey, JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS);
    } catch (err) {
      console.error('funnel-data cache write error', err);
    }

    return res.status(200).json(payload);
  } catch (err) {
    console.error('funnel-data error', err);
    return res.status(500).json({ error: 'Erro ao ler os dados do funil' });
  }
};

// Upstash devolve HGETALL como array plano [k1,v1,k2,v2,...] via REST.
function arrToObj(arr) {
  const out = {};
  if (!Array.isArray(arr)) return out;
  for (let i = 0; i < arr.length; i += 2) out[arr[i]] = arr[i + 1];
  return out;
}

// Apelidos das campanhas. O anuncio manda o ID ({{campaign.id}}), que e unico e
// nao muda, e aqui ele vira um nome legivel so na hora de mostrar. Nada e
// regravado no Redis, entao vale pras vendas antigas e pras novas.
// Campanha nova: e so acrescentar o ID aqui.
const CAMPAIGN_NAMES = {
  '120251182110130180': 'Rumo a Glória',
  '120251968043270180': 'Prezin',
};

// ZREVRANGE ... WITHSCORES devolve [member, score, member, score, ...].
function parseSales(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (let i = 0; i < arr.length; i += 2) {
    let obj = {};
    try { obj = JSON.parse(arr[i]); } catch { obj = {}; }
    out.push({
      name: obj.n || 'Cliente',
      tierName: obj.t || '—',
      // Number(): a PushInPay às vezes devolve o valor como texto ("2990"), e
      // JSON.parse preserva isso como string. "+" concatena string em vez de
      // somar (0 + "2990" + "1000" virava "029901000" no faturamento total).
      valueCents: Number(obj.v) || 0,
      adRef: obj.a || 'Sem anúncio',
      // Campanha e conjunto: gravados a partir de 15/09. Venda antiga vem null.
      campaign: CAMPAIGN_NAMES[obj.c] || obj.c || null,
      // Com a campanha ja nomeada, o ID do conjunto so polui a coluna.
      adset: CAMPAIGN_NAMES[obj.c] ? null : (obj.s || null),
      ip: obj.i || null,
      // Vendas gravadas antes de 07/09 nao tem plataforma, e as que entram
      // pela rede de seguranca do webhook nunca vao ter. As duas viram
      // 'Sem dado' no painel em vez de sumir da tabela: sumindo, a
      // porcentagem mentiria por omissao.
      platform: obj.p || null,
      ts: Number(arr[i + 1]) || obj.ts || 0,
    });
  }
  return out;
}
