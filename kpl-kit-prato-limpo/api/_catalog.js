// Fonte de verdade dos preços (em CENTAVOS). O front NUNCA define o valor:
// o servidor recalcula tudo a partir daqui. Mantenha em sincronia com o
// TIERS e o array BUMPS do index.html.

// Dois planos: Essencial (barato, atrai) e Completo (premium, sobe o ticket).
const TIERS = {
  essencial: { id: 'essencial', name: 'KPL Essencial', priceCents: 1000 },
  completo: { id: 'completo', name: 'KPL Completo', priceCents: 2990 },
  // Mesmo produto do Completo, com desconto. Só é enviado pelo front quando a
  // pessoa aceita o pop-up de downsell (ia levar o Essencial e sobe pro Completo).
  completo_promo: { id: 'completo_promo', name: 'KPL Completo', priceCents: 1990 },
  // UPGRADE (21/08, repreçado em 27/08, 01/09, 07/09 e 12/09): quem já comprou
  // o Essencial por R$ 10,00 completa por R$ 12,70 e passa a ter tudo do
  // Completo, inclusive o app. Total pago vira R$ 22,70, contra R$ 29,90 de
  // quem compra o Completo direto: a diferença é de propósito, pra ela sentir
  // que ganhou por ter começado pequeno, e não que foi punida.
  //
  // ESTE VALOR NUNCA PODE FICAR PARADO quando o Essencial ou o Completo muda.
  // Ele é DERIVADO dos dois, e as duas pontas do erro já aconteceram aqui:
  //   - alto demais: com o Essencial a 19,90, um upgrade de 17,90 fazia o
  //     caminho longo custar 37,80, MAIS CARO que os 37,00 do Completo direto;
  //   - barato demais: com o Essencial a 10,00, um upgrade de 8,90 faria o
  //     total ser 18,90, só 63% do Completo, e aí ninguém escolhe o Completo de
  //     primeira, porque entrar pelo Essencial sairia bem mais barato.
  //
  // A regra: essencial + upgrade tem que cair entre 76% e 78% do Completo.
  // Hoje: 10,00 + 12,70 = 22,70, que é 76% de 29,90.
  // Entregue como Completo sem precisar de mais nada: download.js e kit-access.js
  // só desviam pro Essencial quando o tier é literalmente 'essencial'.
  upgrade: { id: 'upgrade', name: 'KPL Upgrade (Essencial -> Completo)', priceCents: 1270 },
  // EDIÇÃO PROFISSIONAL (22/08): outro público (nutricionista que atende
  // infantil), outro material (30 fichas de consultório na frente + licença de
  // uso com pacientes) e outro PDF. Vendida em /profissional, que hoje está
  // FORA DO AR de propósito: a página existe pronta mas não é linkada em lugar
  // nenhum e tem noindex, esperando a validação da oferta com as seguidoras.
  //
  // Fica acima de qualquer preço de mãe de propósito: preço baixo em material
  // clínico soa amador, e o teto de CPA aqui é ~10x o do produto de R$ 10.
  profissional: { id: 'profissional', name: 'KPL Edição Profissional', priceCents: 6700 },
  // Plano de entrada da /profissional (19/09): as mesmas 189 fichas e a licenca,
  // so o PDF, sem o app. Recebe o link direto do PDF, nao o /mi-kit.
  // 21/09: preco cheio 46,90 e o cupom leva a 32,90. NAO usar 4700 aqui: esse
  // valor ja e o do plano completo COM cupom, e dois planos com o mesmo valor
  // fazem a entrega (que casa por valor) mandar o produto errado.
  profissional_pdf: { id: 'profissional_pdf', name: 'KPL Edição Profissional (PDF)', priceCents: 4690 },
};
const DEFAULT_TIER = 'completo';

// Order bumps opcionais (hoje desligados no front, mas o servidor ainda
// recalcula corretamente se algum vier). Mantenha em sincronia com index.html.
const BUMPS = {
  bump1: { name: 'Cardápio de 4 semanas anti-seletividade', priceCents: 990 },
  bump2: { name: 'Áudios para acalmar a hora da refeição', priceCents: 1490 },
  // Bump da /profissional (17/09). Entregue como PDF proprio, ver _entrega.js.
  // Id 'devolutiva' mantido: e o ?item= do download e a chave do manifesto.
  // O nome que a pessoa le mudou pra Bloco de Evolução em 17/09.
  devolutiva: { name: 'Bloco de Evolução', priceCents: 1000 },
};

// O bump da devolutiva e reconhecido pelo VALOR, nao pela lista de bumps: o
// webhook (rede de seguranca) nunca recebe essa lista, e sem isso a compra que
// cai por la sairia sem o material pago. R$ 47 + R$ 10 (R$ 57) nao colide com nenhum
// tier, entao da pra inferir com seguranca.
// CUPOM (20/09): o preco cheio da Edicao Profissional voltou a ser R$ 67,00 e o
// cupom derruba pra R$ 47,00, que era o preco anunciado desde 19/09. A ancora e
// verdadeira: 67 foi o preco praticado de 22/08 a 19/09.
//
// Quem aplica o desconto e o SERVIDOR: o front manda o codigo, nunca o valor.
// O codigo do cupom E O MES (SETEMBRO30, OUTUBRO30...), calculado na hora nos
// dois lados. Assim a promocao vira sazonal de verdade sem ninguem precisar
// lembrar de trocar o nome todo dia 1, e um print antigo com o mes passado para
// de valer sozinho.
//
// Sem acento de proposito (MARCO30, nao MARÇO30): cupom com cedilha e acento
// quebra na hora de digitar e de comparar. Esta lista tem que ser IGUAL a do
// profissional.html.
const MESES = ['JANEIRO','FEVEREIRO','MARCO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
const DESCONTO_MENSAL = { profissional: 2000, profissional_pdf: 1400 };

// Mes de Sao Paulo, nao do servidor (que roda em UTC): perto da meia-noite os
// dois discordam, e o codigo que a pessoa ve na tela tem que ser o mesmo que o
// servidor aceita.
function mesAtualSP(quando) {
  const d = quando || new Date();
  const m = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', month: 'numeric' }).format(d);
  return Number(m) - 1;
}
function cupomDoMes(indice) {
  return MESES[((indice % 12) + 12) % 12] + '30';
}
// O mes ANTERIOR continua valendo. Motivo pratico: quem abriu a pagina 23h50 do
// dia 30 e gera o Pix depois da meia-noite teria o cupom recusado e pagaria o
// preco cheio sem entender por que.
function cupomValido(codigo, tierId) {
  const limpo = String(codigo || '').trim().toUpperCase();
  const mes = mesAtualSP();
  const aceitos = [cupomDoMes(mes), cupomDoMes(mes - 1)];
  if (!aceitos.includes(limpo)) return null;
  const desconto = DESCONTO_MENSAL[tierId];
  return desconto ? { codigo: limpo, descontoCents: desconto } : null;
}

// VALORES DA /profissional. Com o cupom, o valor pago deixou de ser o preco
// base do tier, entao casar "pelo mais proximo por baixo" passou a errar: R$ 47
// (profissional com cupom) caia no profissional_pdf de R$ 32,90, e aquela conta
// de bump (32,90 + 10 = 42,90) dava o Bloco de Evolução de graça pra quem nao
// comprou. Por isso os valores da /profissional sao uma tabela explicita.
const BASES_PRO = [
  { valor: 6700, tier: 'profissional' },      // completo, preco cheio
  { valor: 4700, tier: 'profissional' },      // completo com o cupom SETEMBRO30
  { valor: 4690, tier: 'profissional_pdf' },  // so PDF, preco cheio
  { valor: 3290, tier: 'profissional_pdf' },  // so PDF com o cupom SETEMBRO30
];
const VALORES_PRO = new Map();
for (const b of BASES_PRO) {
  VALORES_PRO.set(b.valor, b.tier);
  VALORES_PRO.set(b.valor + BUMPS.devolutiva.priceCents, b.tier);
}

function pedidoTemDevolutiva(valueCents) {
  const v = Number(valueCents) || 0;
  return BASES_PRO.some((b) => b.valor + BUMPS.devolutiva.priceCents === v);
}

// Recalcula o total confiável a partir do tier + ids de bump recebidos do front.
function computeOrder(tierId, bumpIds = [], cupom) {
  const tier = TIERS[tierId] || TIERS[DEFAULT_TIER];
  const items = [{ id: tier.id, name: tier.name, priceCents: tier.priceCents }];
  const seen = new Set();
  for (const id of Array.isArray(bumpIds) ? bumpIds : []) {
    if (BUMPS[id] && !seen.has(id)) {
      seen.add(id);
      items.push({ id, name: BUMPS[id].name, priceCents: BUMPS[id].priceCents });
    }
  }
  // Cupom entra como item NEGATIVO, pra soma continuar sendo uma soma so.
  const desconto = cupomValido(cupom, tier.id);
  if (desconto) {
    items.push({ id: 'cupom', name: 'Cupom ' + desconto.codigo, priceCents: -desconto.descontoCents });
  }
  const totalCents = Math.max(0, items.reduce((s, i) => s + i.priceCents, 0));
  return { items, totalCents, tierId: tier.id, tierName: tier.name, cupom: desconto ? desconto.codigo : null };
}

// Dado um valor em centavos, descobre qual plano foi (usado na entrega/aviso,
// pra o admin saber o que mandar por WhatsApp). Casa pelo preço base do tier.
//
// CUIDADO com pagamento ANTIGO: os preços já mudaram várias vezes e os valores
// se CRUZARAM, então casar por valor erra o tier de venda velha.
//
// Depois do repreço de 12/09, dois valores voltaram a casar com um tier, só que
// com significado DIFERENTE do que tinham antes. Isso é pior que não casar:
// quando não casa, cai na regra do mais próximo por baixo e o número destoa;
// quando casa errado, a entrega manda o kit errado em silêncio.
//   R$ 19,90 = completo_promo antes de 27/08
//              essencial de 27/08 a 31/08 e de 07/09 a 12/09
//              completo_promo de novo hoje  <- casa, e entrega o COMPLETO
//   R$ 29,90 = completo antes de 27/08
//              completo_promo de 27/08 a 31/08
//              completo de novo hoje        <- casa
//   R$ 23,90 = completo_promo de 07/09 a 12/09, hoje não casa com nada.
//   R$ 37,00 = completo de 07/09 a 12/09, hoje não casa com nada.
//   R$ 47,00 = completo até 31/08, e PROFISSIONAL desde 19/09  <- casa, e
//              entrega o kit PROFISSIONAL pra uma venda antiga do Completo.
//   R$ 67,00 = profissional de 22/08 a 19/09, hoje não casa com nada.
//   R$ 8,90 e R$ 15,90 = upgrades antigos, hoje não casam com nada.
// Só importa se você reenviar o POST de uma venda velha na PushInPay:
// reconferir o tier na mão antes, senão a pessoa recebe o kit errado.
function tierFromValueCents(valueCents) {
  const pro = VALORES_PRO.get(Number(valueCents));
  if (pro) return TIERS[pro];
  for (const t of Object.values(TIERS)) {
    if (t.priceCents === valueCents) return t;
  }
  // Se teve bump ou não bateu exato, cai no mais próximo por baixo.
  const sorted = Object.values(TIERS).sort((a, b) => b.priceCents - a.priceCents);
  return sorted.find((t) => valueCents >= t.priceCents) || sorted[sorted.length - 1];
}

module.exports = { TIERS, BUMPS, DEFAULT_TIER, cupomDoMes, mesAtualSP, cupomValido, computeOrder, tierFromValueCents, pedidoTemDevolutiva };
