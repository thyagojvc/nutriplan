// Fonte de verdade dos preços (em CENTAVOS). O front NUNCA define o valor:
// o servidor recalcula tudo a partir daqui. Mantenha em sincronia com o
// TIERS e o array BUMPS do index.html.

// Dois planos: Essencial (barato, atrai) e Completo (premium, sobe o ticket).
const TIERS = {
  essencial: { id: 'essencial', name: 'KPL Essencial', priceCents: 1000 },
  completo: { id: 'completo', name: 'KPL Completo', priceCents: 3700 },
  // Mesmo produto do Completo, com desconto. Só é enviado pelo front quando a
  // pessoa aceita o pop-up de downsell (ia levar o Essencial e sobe pro Completo).
  completo_promo: { id: 'completo_promo', name: 'KPL Completo', priceCents: 2390 },
  // UPGRADE (21/08, repreçado em 27/08 e em 01/09): quem já comprou o
  // Essencial por R$ 10,00 completa por R$ 17,90 e passa a ter tudo do
  // Completo, inclusive o app. Total pago vira R$ 27,90, contra R$ 37 de quem
  // compra o Completo direto: a diferença é de propósito, pra ela sentir que
  // ganhou por ter começado pequeno, e não que foi punida.
  //
  // O valor ACOMPANHA o Completo, não é solto: 27,90 é 75% de 37, a mesma
  // proporção que 35,80 era de 47. Ele NÃO pode ficar parado quando o Completo
  // muda. Se tivesse continuado em R$ 15,90 agora que o Essencial caiu pra
  // R$ 10, o caminho Essencial + upgrade sairia por R$ 25,90 contra R$ 37 no
  // direto, ou seja, 30% mais barato pelo caminho mais longo, e ninguém
  // escolheria o Completo de primeira.
  // Entregue como Completo sem precisar de mais nada: download.js e kit-access.js
  // só desviam pro Essencial quando o tier é literalmente 'essencial'.
  upgrade: { id: 'upgrade', name: 'KPL Upgrade (Essencial -> Completo)', priceCents: 1790 },
  // EDIÇÃO PROFISSIONAL (22/08): outro público (nutricionista que atende
  // infantil), outro material (30 fichas de consultório na frente + licença de
  // uso com pacientes) e outro PDF. Vendida em /profissional, que hoje está
  // FORA DO AR de propósito: a página existe pronta mas não é linkada em lugar
  // nenhum e tem noindex, esperando a validação da oferta com as seguidoras.
  //
  // Fica acima de qualquer preço de mãe de propósito: preço baixo em material
  // clínico soa amador, e o teto de CPA aqui é ~10x o do produto de R$ 10.
  profissional: { id: 'profissional', name: 'KPL Edição Profissional', priceCents: 6700 },
};
const DEFAULT_TIER = 'completo';

// Order bumps opcionais (hoje desligados no front, mas o servidor ainda
// recalcula corretamente se algum vier). Mantenha em sincronia com index.html.
const BUMPS = {
  bump1: { name: 'Cardápio de 4 semanas anti-seletividade', priceCents: 990 },
  bump2: { name: 'Áudios para acalmar a hora da refeição', priceCents: 1490 },
};

// Recalcula o total confiável a partir do tier + ids de bump recebidos do front.
function computeOrder(tierId, bumpIds = []) {
  const tier = TIERS[tierId] || TIERS[DEFAULT_TIER];
  const items = [{ id: tier.id, name: tier.name, priceCents: tier.priceCents }];
  const seen = new Set();
  for (const id of Array.isArray(bumpIds) ? bumpIds : []) {
    if (BUMPS[id] && !seen.has(id)) {
      seen.add(id);
      items.push({ id, name: BUMPS[id].name, priceCents: BUMPS[id].priceCents });
    }
  }
  const totalCents = items.reduce((s, i) => s + i.priceCents, 0);
  return { items, totalCents, tierId: tier.id, tierName: tier.name };
}

// Dado um valor em centavos, descobre qual plano foi (usado na entrega/aviso,
// pra o admin saber o que mandar por WhatsApp). Casa pelo preço base do tier.
//
// CUIDADO com pagamento ANTIGO: os preços já mudaram duas vezes e os valores
// se cruzaram, então casar por valor erra o tier de venda velha.
//   R$ 19,90 = completo_promo antes de 27/08, essencial de 27/08 a 31/08, e
//              hoje não casa com tier nenhum.
//   R$ 29,90 = completo antes de 27/08, completo_promo de 27/08 a 31/08, e
//              hoje não casa com nada.
//   R$ 47,00 = completo até 31/08, hoje não casa com nada.
// Só importa se você reenviar o POST de uma venda velha na PushInPay:
// reconferir o tier na mão antes, senão a pessoa recebe o kit errado.
function tierFromValueCents(valueCents) {
  for (const t of Object.values(TIERS)) {
    if (t.priceCents === valueCents) return t;
  }
  // Se teve bump ou não bateu exato, cai no mais próximo por baixo.
  const sorted = Object.values(TIERS).sort((a, b) => b.priceCents - a.priceCents);
  return sorted.find((t) => valueCents >= t.priceCents) || sorted[sorted.length - 1];
}

module.exports = { TIERS, BUMPS, DEFAULT_TIER, computeOrder, tierFromValueCents };
