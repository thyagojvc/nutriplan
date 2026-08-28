// Fonte de verdade dos preços (em CENTAVOS). O front NUNCA define o valor:
// o servidor recalcula tudo a partir daqui. Mantenha em sincronia com o
// TIERS e o array BUMPS do index.html.

// Dois planos: Essencial (barato, atrai) e Completo (premium, sobe o ticket).
const TIERS = {
  essencial: { id: 'essencial', name: 'KPL Essencial', priceCents: 1990 },
  completo: { id: 'completo', name: 'KPL Completo', priceCents: 4700 },
  // Mesmo produto do Completo, com desconto. Só é enviado pelo front quando a
  // pessoa aceita o pop-up de downsell (ia levar o Essencial e sobe pro Completo).
  completo_promo: { id: 'completo_promo', name: 'KPL Completo', priceCents: 2990 },
  // UPGRADE (21/08, repreçado em 27/08): quem já comprou o Essencial por
  // R$ 19,90 completa por R$ 15,90 e passa a ter tudo do Completo, inclusive o
  // app. Total pago vira R$ 35,80, contra R$ 47 de quem compra o Completo
  // direto: a diferença é de propósito, pra ela sentir que ganhou por ter
  // começado pequeno, e não que foi punida.
  //
  // O valor ACOMPANHA o Completo, não é solto: 35,80 é 76% de 47, a mesma
  // proporção que 22,70 era de 29,90. Se o upgrade tivesse ficado nos R$ 12,70
  // antigos, o caminho Essencial + upgrade sairia por R$ 32,60 contra R$ 47 no
  // direto, e ninguém escolheria o Completo de primeira.
  // Entregue como Completo sem precisar de mais nada: download.js e kit-access.js
  // só desviam pro Essencial quando o tier é literalmente 'essencial'.
  upgrade: { id: 'upgrade', name: 'KPL Upgrade (Essencial -> Completo)', priceCents: 1590 },
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
// CUIDADO com pagamento ANTIGO (anterior a 27/08): os preços mudaram e os
// valores se cruzaram. R$ 19,90 era completo_promo e hoje casa com essencial;
// R$ 29,90 era completo e hoje casa com completo_promo. Só importa se você
// reenviar o POST de uma venda velha na PushInPay: reconferir o tier na mão
// antes, senão quem pagou R$ 19,90 pelo Completo recebe o Essencial.
function tierFromValueCents(valueCents) {
  for (const t of Object.values(TIERS)) {
    if (t.priceCents === valueCents) return t;
  }
  // Se teve bump ou não bateu exato, cai no mais próximo por baixo.
  const sorted = Object.values(TIERS).sort((a, b) => b.priceCents - a.priceCents);
  return sorted.find((t) => valueCents >= t.priceCents) || sorted[sorted.length - 1];
}

module.exports = { TIERS, BUMPS, DEFAULT_TIER, computeOrder, tierFromValueCents };
