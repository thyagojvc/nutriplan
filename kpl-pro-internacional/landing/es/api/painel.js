// GET /api/painel?k=<PAINEL_KEY>&r=hoje|ontem|7|14|30  ·  Painel do funil do Mesa a Mesa.
// Le as visitas (mam:fun:<dia>, gravadas pelo /api/f), quem esta ao vivo (mam:on) e as
// vendas (mam:cpr:<dia>, gravadas pelo webhook do app). Mesmo desenho do /funil do KPL:
// ao vivo, funil de abandono pela secao mais funda, vendas, anuncio/campanha/conjunto,
// dispositivo, sistema e navegador. A pagina se atualiza sozinha a cada 60 s com a aba aberta.
const ipDaMeta = require('./_meta-ip');
const ETAPAS = [
  'Topo', 'Viu o material por dentro', 'A dor', 'O método', 'A ficha por dentro', 'As folhas do niño',
  'As 12 etapas', 'Para quem é', 'Os depoimentos', 'O autor', 'A garantia', 'A oferta', 'Os planos',
  'Perguntas frequentes', 'Final da página', 'Clicou no checkout', 'Comprou',
];
// Página das mães (/, desde 21/10): menos seções; as posições que ela não usa ficam null e
// somem do funil. A profissional mudou para /profesional e continua com a lista de cima.
const ETAPAS_MADRES = [
  'Topo', 'Viu as fichas rolando', 'O que cada ficha contém', 'Para quem é', 'O que recebe', 'Os 4 bônus',
  'Os planos', 'A garantia', 'Perguntas frequentes', null, null, null,
  null, null, null, 'Clicou no checkout', 'Comprou',
];
const PLANOS_MADRES = 7; // estrutura nova da página (22/10)
// /familias desde 31/10/2026: entrou "A dor" depois do topo e "Como se usa" depois das fichas.
// Visitas anteriores a isso ficam com a etapa deslocada (poucas, primeiro dia de anúncio).
const ETAPAS_FAMILIAS = [
  'Topo', 'A dor', 'Viu as fichas rolando', 'Como se usa (3 passos)', 'O que cada ficha contém', 'Para quem é',
  'O que recebe', 'Os 4 bônus', 'Os planos', 'A garantia', 'Perguntas frequentes', null,
  null, null, null, 'Clicou no checkout', 'Comprou',
];
const PLANOS_FAMILIAS = 9;
const CHECKOUT = 16; const COMPRA = 17; const PLANOS = 13;

async function pipeline(cmds) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL + '/pipeline', {
    method: 'POST', headers: { Authorization: 'Bearer ' + process.env.UPSTASH_REDIS_REST_TOKEN }, body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('Upstash ' + r.status);
  return (await r.json()).map((x) => x.result);
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// utm chega percent-encoded ("Video+MIX%C3%A1"); '+' vira espaco antes do decode
function deco(x) {
  if (!x) return '';
  let t = String(x).replace(/\+/g, ' ');
  try { t = decodeURIComponent(t); } catch (e) { /* fica como veio */ }
  // macro do Meta nao substituida = clique organico/preview, nao e um criativo
  if (/\{\{.*\}\}/.test(t)) return '(macro do Meta sem substituir)';
  return t.replace(/[<>"]/g, '').trim();
}
// Fuso escolhido no painel (?tz=br|es). Os dias GRAVADOS no banco seguem o calendario de Madri;
// a leitura carrega os dias de Madri que cobrem o periodo e filtra cada visita/venda pelo dia
// no fuso escolhido. Assim "Hoje" em Brasilia e o dia de Brasilia, de meia-noite a meia-noite.
const FUSOS = { br: ['America/Sao_Paulo', 'Brasília'], es: ['Europe/Madrid', 'Espanha'] };
let TZ = FUSOS.br[0];
const ymd = (t, tz) => {
  const [d, m, a] = new Date(t).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz }).split('/');
  return a + m + d;
};
const dia = (offset, tz = TZ) => ymd(Date.now() - offset * 864e5, tz);
const quando = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: TZ }).replace(',', '');
const pct = (n, de) => (de ? Math.round((n / de) * 100) + '%' : '·');
const eur = (n) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const dinheiro = (n, moeda) => { const m = /^[A-Z]{3}$/.test(moeda || '') ? moeda : 'EUR'; try { return Number(n).toLocaleString('es-ES', { style: 'currency', currency: m }); } catch (e) { return n + ' ' + m; } };
// soma por moeda: { EUR: 12.9, USD: 19.9 } -> "12,90 € + 19,90 US$"
const somaMoedas = (lista) => { const t = {}; for (const v of lista) if (v && v.valor) t[v.moeda || 'EUR'] = (t[v.moeda || 'EUR'] || 0) + Number(v.valor); const k = Object.keys(t); return k.length ? k.map((m) => dinheiro(t[m], m)).join(' + ') : eur(0); };

module.exports = async (req, res) => {
  const q = req.query || {};
  const k = String(q.k || '');
  if (!process.env.PAINEL_KEY || k !== process.env.PAINEL_KEY) return res.status(401).send('Acesso negado');
  const r = ['hoje', 'ontem', '7', '14', '30'].includes(q.r) ? q.r : 'hoje';
  const tz = FUSOS[q.tz] ? q.tz : 'br';
  // pagina: as duas, so a da Espanha ou so a latino-americana (/latam). Visita antiga sem marca = Espanha.
  const PAGINAS = { todas: 'Todas as páginas', es: '🇪🇸 Profissional Espanha (EUR)', latam: '🌎 LatAm (USD)', madres: '👩‍👧 Mães Espanha (EUR)', familias: '👩‍👧 Mães LatAm (USD)' };
  const pg = PAGINAS[q.pg] ? q.pg : 'todas';
  // /familias (29/10) é a mesma página das mães, então usa o mesmo funil
  const maes = pg === 'madres' || pg === 'familias';
  const ET = pg === 'familias' ? ETAPAS_FAMILIAS : maes ? ETAPAS_MADRES : ETAPAS;
  const VIU_PLANOS = pg === 'familias' ? PLANOS_FAMILIAS : maes ? PLANOS_MADRES : PLANOS;
  TZ = FUSOS[tz][0];
  // Excluir visita (teste, visita propria): apaga a(s) sessao(oes) do hash do dia e do "ao vivo".
  // A venda, se houver, continua em Vendas (aparece como "sem visita na pagina").
  if (q.del) {
    const alvos = String(q.del).split(',').map((x) => x.split('|')).filter(([d, ss]) => /^\d{8}$/.test(d) && /^[a-z0-9]{8,20}$/.test(ss || ''));
    if (alvos.length) await pipeline(alvos.flatMap(([d, ss]) => [['HDEL', 'mam:fun:' + d, ss], ['ZREM', 'mam:on', ss + '|' + d]]));
    res.setHeader('Location', '?k=' + encodeURIComponent(k) + '&r=' + r + '&tz=' + tz + '&pg=' + pg);
    return res.status(303).end();
  }
  // dias do periodo no fuso escolhido + os dias de Madri (chaves do banco) que cobrem esse periodo
  const periodo = new Set(r === 'hoje' ? [dia(0)] : r === 'ontem' ? [dia(1)] : Array.from({ length: Number(r) }, (_, i) => dia(i)));
  const n = r === 'hoje' ? 0 : r === 'ontem' ? 1 : Number(r) - 1;
  const dias = [...new Set(Array.from({ length: n + 3 }, (_, i) => dia(i - 1, 'Europe/Madrid')))];
  const agora = Date.now();

  const cmds = [['ZREMRANGEBYSCORE', 'mam:on', 0, agora - 40000], ['ZRANGE', 'mam:on', 0, -1]];
  for (const d of dias) cmds.push(['HGETALL', 'mam:fun:' + d], ['HGETALL', 'mam:cpr:' + d]);
  const out = await pipeline(cmds);
  const aoVivo = new Set((out[1] || []).map((x) => x.split('|')[0]));

  let visitas = []; const vendas = [];
  dias.forEach((d, i) => {
    const h = out[2 + i * 2] || []; const c = out[3 + i * 2] || [];
    for (let j = 0; j < h.length; j += 2) {
      let v; try { v = JSON.parse(h[j + 1]); } catch (e) { continue; }
      if (!periodo.has(ymd(v.t0 || v.t1, TZ))) continue;
      if (ipDaMeta(v.ip)) continue; // robo de revisao da Meta gravado antes do filtro no /api/f
      const lp = ['latam', 'madres', 'familias'].includes(v.l) ? v.l : 'es';
      if (pg !== 'todas' && lp !== pg) continue;
      visitas.push({ ...v, l: PAGINAS[lp], s: h[j], d, o: deco(v.o) || '(direto)', a: deco(v.a), cp: deco(v.cp), cj: deco(v.cj) });
    }
    for (let j = 0; j < c.length; j += 2) {
      let v; try { v = JSON.parse(c[j + 1]); } catch (e) { continue; }
      if (!periodo.has(ymd(v.t, TZ))) continue;
      vendas.push({ ...v, s: c[j], d });
    }
  });

  // MESMA PESSOA, VARIAS ABERTURAS (como no KPL): o navegador do Instagram abre sessao nova
  // a cada toque no anuncio. Junta, so na leitura, visitas com mesmo IP e mesmo anuncio em
  // que uma comeca ate 30 min depois da anterior. Fica a parte mais funda alcancada.
  visitas.sort((x, y) => x.t0 - y.t0);
  const juntas = []; const ult = {};
  for (const v of visitas) {
    const chave = v.ip && v.ip + '|' + v.a;
    const ant = chave && ult[chave];
    if (ant && v.t0 - ant.t1 < 30 * 60e3) {
      ant.p = Math.max(ant.p, v.p); ant.t1 = Math.max(ant.t1, v.t1); ant.c = v.c; ant.pl = v.pl || ant.pl;
      ant.ses.push(v.s); ant.chaves.push(v.d + '|' + v.s); ant.aberturas++;
    } else {
      const n = { ...v, ses: [v.s], chaves: [v.d + '|' + v.s], aberturas: 1 }; juntas.push(n); if (chave) ult[chave] = n;
    }
  }
  visitas = juntas;
  // venda casada com a visita pela sessao do sck
  const porSessao = {}; for (const v of visitas) for (const s of v.ses) porSessao[s] = v;
  for (const vd of vendas) { const v = porSessao[vd.s]; if (v) { v.p = COMPRA; v.venda = vd; vd.visita = v; } }
  // filtrando por pagina, so entra a venda que veio de uma visita dessa pagina
  if (pg !== 'todas') { const ficam = vendas.filter((vd) => vd.visita); vendas.length = 0; vendas.push(...ficam); }

  const total = visitas.length;
  const chegou = ET.map((_, i) => visitas.filter((v) => v.p >= i + 1).length);
  const fat = vendas.reduce((t, v) => t + (Number(v.valor) || 0), 0);
  const ativos = visitas.filter((v) => v.ses.some((s) => aoVivo.has(s)));

  // Abre "Clicou no checkout" e "Comprou" por plano. O plano da compra vem do nome do produto
  // na Hotmart; sem ele, do botao que a pessoa clicou.
  const planoDe = (v, etapa) => {
    if (etapa === COMPRA && v.venda) return /complet/i.test(v.venda.produto || '') ? 'completo' : /b[aá]sic/i.test(v.venda.produto || '') ? 'basico' : /esencial/i.test(v.venda.produto || '') ? 'esencial' : (v.pl || '');
    return v.pl || '';
  };
  const porPlano = (etapa) => {
    const base = visitas.filter((v) => (etapa === COMPRA ? v.venda : v.p >= CHECKOUT));
    if (!base.length) return '';
    const lista = pg === 'familias' ? [['esencial', 'Esencial (US$ 7,90)'], ['completo', 'Completo (US$ 9,90)']] : pg === 'madres' ? [['esencial', 'Esencial (9,90 €)'], ['completo', 'Completo (12,90 €)']] : [['basico', 'Plan básico (12,90 €)'], ['completo', 'Plan completo (19,90 €)']];
    return [...lista, ['', 'Plano não identificado']].map(([id, nome]) => {
      const n = base.filter((v) => planoDe(v, etapa) === id).length;
      if (!n && id === '') return '';
      const w = total ? Math.max(1.5, (n / total) * 100) : 0;
      return `<tr class="sub"><td>↳ ${nome}</td><td class="n">${n}</td><td class="n">${pct(n, total)}</td><td class="n">${pct(n, base.length)} ${etapa === COMPRA ? 'das compras' : 'dos cliques'}</td><td class="barra"><i style="width:${w}%"></i></td><td></td></tr>`;
    }).join('');
  };
  const funil = ET.map((nome, i) => {
    if (!nome) return '';
    const w = total ? Math.max(1.5, (chegou[i] / total) * 100) : 0;
    const para = chegou[i] - (chegou[i + 1] || 0);
    const queda = i && chegou[i - 1] ? 1 - chegou[i] / chegou[i - 1] : 0;
    return `<tr class="${i + 1 >= CHECKOUT ? 'forte' : ''}"><td>${i + 1}. ${nome}</td><td class="n">${chegou[i]}</td><td class="n">${pct(chegou[i], total)}</td>
      <td class="n ${queda > 0.3 ? 'ruim' : ''}">${i ? pct(chegou[i], chegou[i - 1]) : ''}</td><td class="barra"><i style="width:${w}%"></i></td><td class="n">${i + 1 < COMPRA ? para : ''}</td></tr>`
      + (i + 1 === CHECKOUT || i + 1 === COMPRA ? porPlano(i + 1) : '');
  }).join('');

  const tabela = (campo, titulo) => {
    const g = {};
    for (const v of visitas) {
      const c = v[campo] || '(sem)'; const x = (g[c] = g[c] || { n: 0, pl: 0, chk: 0, cpr: 0, vendas: [] });
      x.n++; if (v.p >= VIU_PLANOS) x.pl++; if (v.p >= CHECKOUT) x.chk++; if (v.venda) { x.cpr++; x.vendas.push(v.venda); }
    }
    const linhas = Object.entries(g).sort((a, b) => b[1].cpr - a[1].cpr || b[1].n - a[1].n).slice(0, 30)
      .map(([c, x]) => `<tr><td class="nome">${esc(c)}</td><td class="n">${x.n}</td><td class="n">${pct(x.pl, x.n)}</td><td class="n">${x.chk}</td><td class="n">${x.cpr}</td><td class="n">${x.vendas.length ? somaMoedas(x.vendas) : '·'}</td><td class="n">${pct(x.cpr, x.n)}</td></tr>`).join('');
    return `<h2>${titulo}</h2><div class="box"><table><tr><th>${titulo.split(' ')[1] || 'Item'}</th><th class="n">Visitas</th><th class="n">Viu planos</th><th class="n">Checkout</th><th class="n">Compras</th><th class="n">Faturado</th><th class="n">Conversão</th></tr>${linhas || '<tr><td colspan="7" class="vazio">Sem dados no período.</td></tr>'}</table></div>`;
  };

  const vivo = ativos.map((v) => `<tr><td><span class="pt"></span>${esc(ET[(v.c || v.p) - 1] || '')}</td><td>${esc(ET[v.p - 1] || '')}</td><td>${esc(v.a || v.o)}</td><td>${esc(v.dv)} · ${esc(v.so)} · ${esc(v.nav)}</td><td class="n">${Math.round((v.t1 - v.t0) / 1000)} s</td></tr>`).join('');
  const listaVendas = vendas.sort((a, b) => b.t - a.t).map((v) => `<tr><td>${quando(v.t)}</td><td>${esc(v.nome || '')}</td><td>${esc(v.produto || v.pl || '')}</td><td class="n">${v.valor ? dinheiro(v.valor, v.moeda) : ''}</td><td>${v.visita ? esc(v.visita.a || v.visita.o) : '<i>sem visita na página</i>'}</td></tr>`).join('');
  // Tabela de visitantes no formato do /funil do KPL: uma linha por pessoa (aberturas juntadas),
  // com selecao em massa para apagar teste ou bot. Status: comprou / ao vivo / saiu.
  const dur = (ms) => { const s = Math.round(ms / 1000); return s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s'; };
  const recentes = visitas.slice().sort((a, b) => b.t1 - a.t1).slice(0, 300).map((v) => {
    const vivoAgora = v.ses.some((s) => aoVivo.has(s));
    const status = v.venda ? '<span class="pill ok">Comprou ' + esc(v.venda.valor ? dinheiro(v.venda.valor, v.venda.moeda) : '') + '</span>'
      : vivoAgora ? '<span class="pt"></span>Ao vivo' : '<span class="mu">Saiu</span>';
    const parou = esc(ET[v.p - 1] || '') + (v.p >= CHECKOUT && v.pl && !v.venda ? ' · ' + esc(v.pl) : '');
    const chave = esc(v.chaves.join(','));
    return `<tr data-del="${chave}"><td class="chk"><input type="checkbox" class="rchk"></td><td class="mu">${esc(v.s.slice(0, 8))}</td><td>${quando(v.t0)}</td>
      <td>${esc(v.dv || '·')}</td><td>${esc(v.so || '·')}</td><td class="mu">${esc(v.nav || '·')}</td><td class="mu">${esc(v.o)}</td>
      <td class="nome">${esc(v.a || '·')}</td><td class="nome mu">${esc([v.cp, v.cj].filter(Boolean).join(' · ') || '·')}</td>
      <td class="mu">${esc(v.ip || '·')}</td><td class="n">${dur(v.t1 - v.t0)}</td><td>${parou}</td><td class="n">${v.aberturas > 1 ? v.aberturas + 'x' : ''}</td><td>${status}</td></tr>`;
  }).join('');
  const nomes = { hoje: 'Hoje', ontem: 'Ontem', 7: '7 dias', 14: '14 dias', 30: '30 dias' };
  const opc = ['hoje', 'ontem', '7', '14', '30'].map((x) => `<a class="${x === r ? 'on' : ''}" href="?k=${encodeURIComponent(k)}&r=${x}&tz=${tz}&pg=${pg}">${nomes[x]}</a>`).join('')
    + '<span class="sep"></span>' + Object.keys(FUSOS).map((z) => `<a class="${z === tz ? 'on' : ''}" href="?k=${encodeURIComponent(k)}&r=${r}&tz=${z}&pg=${pg}">${z === 'br' ? '🇧🇷' : '🇪🇸'} Horário de ${FUSOS[z][1]}</a>`).join('')
    + '<span class="sep"></span>' + Object.keys(PAGINAS).map((g) => `<a class="${g === pg ? 'on' : ''}" href="?k=${encodeURIComponent(k)}&r=${r}&tz=${tz}&pg=${g}">${PAGINAS[g]}</a>`).join('');
  const kpi = (v, t) => `<div class="kpi"><b>${v}</b><span>${t}</span></div>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.status(200).send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Funil Mesa a Mesa</title><link rel="icon" href="/favicon-32.png">
<style>:root{--p:#FFF8EC;--t:#1D2B24;--v:#1E5631;--r:#E2462F;--l:#EADFCB;--s:#6A766E}
body{margin:0;background:var(--p);color:var(--t);font:14.5px/1.45 system-ui,sans-serif}.c{max-width:1100px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:26px;margin:0}h2{font-size:17px;margin:28px 0 10px}.sub{color:var(--s);margin:2px 0 14px;font-size:13px}
.f a{display:inline-block;padding:7px 14px;border-radius:99px;border:1px solid var(--l);background:#fff;color:var(--t);text-decoration:none;margin:0 6px 6px 0}.f .sep{display:inline-block;width:1px;height:22px;background:var(--l);margin:0 10px 0 4px;vertical-align:middle}.f a.on{background:var(--v);color:#fff;border-color:var(--v)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:14px 0}
.kpi{background:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 1px 0 var(--l)}.kpi b{display:block;font-size:24px}.kpi span{color:var(--s);font-size:12.5px}
.box{background:#fff;border-radius:14px;padding:4px 12px;overflow-x:auto;box-shadow:0 1px 0 var(--l)}
table{width:100%;border-collapse:collapse}td,th{padding:7px 6px;border-bottom:1px solid #F1EADC;text-align:left;white-space:nowrap}
th{font-size:11.5px;color:var(--s);text-transform:uppercase;letter-spacing:.04em}tr:last-child td{border-bottom:0}
.n{text-align:right;font-variant-numeric:tabular-nums}.nome{white-space:normal;max-width:320px}.barra{width:34%}.barra i{display:block;height:11px;border-radius:6px;background:var(--v)}
.forte td{font-weight:700}.sub td{color:var(--s);font-size:13px;padding-top:4px;padding-bottom:4px}.sub td:first-child{padding-left:22px}.sub .barra i{background:#F4B728;height:8px}.forte .barra i{background:var(--r)}.ruim{color:var(--r);font-weight:700}.vazio{color:var(--s);text-align:center;padding:14px}
.pt{display:inline-block;width:8px;height:8px;border-radius:50%;background:#2DBE60;margin-right:7px;animation:p 1.4s infinite}@keyframes p{50%{opacity:.25}}
.bulk{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:-2px 0 8px;font-size:13px}.bulk label{display:inline-flex;gap:6px;align-items:center;cursor:pointer}
.btnd{margin-left:auto;border:1px solid #E2B3A5;background:#FBE0D5;color:#A33418;border-radius:99px;padding:6px 14px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}.btnd:disabled{opacity:.45;cursor:not-allowed}
.chk{width:28px}tr.sel td{background:#FDF6F2}.mu{color:var(--s)}.pill{display:inline-block;border-radius:99px;padding:2px 9px;font-size:12px;font-weight:700}.pill.ok{background:#E4F3DC;color:#2F6B22}
.ajuda{color:var(--s);font-size:12.5px;margin-top:6px}.dois{display:grid;gap:0 16px}@media(min-width:900px){.dois{grid-template-columns:1fr 1fr 1fr}}</style></head><body><div class="c">
<h1>Funil · Mesa a Mesa</h1><p class="sub">Atualiza sozinho a cada 60 s · horário de ${FUSOS[tz][1]} · ${new Date().toLocaleString('pt-BR', { timeZone: TZ })}</p>
<div class="f">${opc}</div>
<div class="kpis">${kpi(ativos.length, 'na página agora')}${kpi(total, 'visitantes')}${kpi(pct(chegou[PLANOS - 1], total), 'chegaram nos planos')}${kpi(chegou[CHECKOUT - 1], 'cliques no checkout')}${kpi(vendas.length, 'compras')}${kpi(somaMoedas(vendas), 'faturado (bruto)')}${kpi(pct(vendas.length, total), 'conversão da página')}</div>
<h2>Ao vivo agora</h2><div class="box"><table><tr><th>Lendo agora</th><th>Mais fundo</th><th>Anúncio / origem</th><th>Aparelho</th><th class="n">Na página</th></tr>${vivo || '<tr><td colspan="5" class="vazio">Ninguém na página neste momento.</td></tr>'}</table></div>
<h2>Onde as pessoas param</h2><div class="box"><table><tr><th>Etapa</th><th class="n">Pessoas</th><th class="n">Do total</th><th class="n">Da anterior</th><th></th><th class="n">Pararam aqui</th></tr>${funil}</table></div>
<p class="ajuda">Etapa = a parte mais funda da página que a pessoa viu. "Pararam aqui" = chegaram nesta e não passaram para a próxima. Em vermelho, quedas de mais de 30% de uma etapa para a seguinte: é onde mexer primeiro.</p>
<h2>Vendas</h2><div class="box"><table><tr><th>Quando</th><th>Nome</th><th>Produto</th><th class="n">Valor</th><th>Veio de</th></tr>${listaVendas || '<tr><td colspan="5" class="vazio">Nenhuma venda no período.</td></tr>'}</table></div>
${tabela('a', 'Por anúncio')}${tabela('cp', 'Por campanha')}${tabela('cj', 'Por conjunto')}
<div class="dois"><div>${tabela('dv', 'Por dispositivo')}</div><div>${tabela('so', 'Por sistema')}</div><div>${tabela('nav', 'Por navegador')}</div></div>
${pg === 'todas' ? tabela('l', 'Por página') : ''}${tabela('o', 'Por origem')}
<h2>Visitantes</h2>
<div class="bulk"><label><input type="checkbox" id="selall"> Selecionar todos os visíveis</label><span class="mu" id="selcount">nenhum selecionado</span><button type="button" class="btnd" id="delbtn" disabled>Apagar selecionados</button></div>
<div class="box"><table><tr><th class="chk"></th><th>ID</th><th>Entrou</th><th>Dispositivo</th><th>Sistema</th><th>Onde abriu</th><th>Origem</th><th>Anúncio</th><th>Campanha · Conjunto</th><th>IP</th><th class="n">Tempo</th><th>Parou em</th><th class="n">Abriu</th><th>Status</th></tr>${recentes || '<tr><td colspan="14" class="vazio">Sem visitantes no período.</td></tr>'}</table></div>
<p class="ajuda">"Abriu 3x" = a mesma pessoa (mesmo IP e mesmo anúncio, em até 30 min) abriu a página mais de uma vez; conta como uma visita só. Apagar serve para limpar teste seu ou bot: só apaga o que estiver marcado e não tem como desfazer. A venda, se houver, continua em Vendas.</p>
</div><script>
const sel=()=>[...document.querySelectorAll('.rchk:checked')];
setInterval(()=>{if(document.visibilityState==='visible'&&!sel().length)location.reload()},60000);
const atualiza=()=>{const n=sel().length,t=document.querySelectorAll('.rchk').length;
document.getElementById('selcount').textContent=n?n+' selecionado'+(n>1?'s':''):'nenhum selecionado';
document.getElementById('delbtn').disabled=!n;document.getElementById('selall').checked=t>0&&n===t;
document.querySelectorAll('.rchk').forEach(c=>c.closest('tr').classList.toggle('sel',c.checked));};
document.addEventListener('change',e=>{if(e.target.id==='selall')document.querySelectorAll('.rchk').forEach(c=>c.checked=e.target.checked);if(e.target.matches('.rchk,#selall'))atualiza();});
document.getElementById('delbtn').addEventListener('click',()=>{const ls=sel();if(!ls.length)return;
if(!confirm('Apagar '+ls.length+' visita'+(ls.length>1?'s':'')+' do painel? Não dá para desfazer.'))return;
const u=new URL(location.href);u.searchParams.set('del',ls.map(c=>c.closest('tr').dataset.del).join(','));location.href=u.toString();});
</script></body></html>`);
};
