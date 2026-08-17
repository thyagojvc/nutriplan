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
function tierFromValueCents(valueCents) {
  for (const t of Object.values(TIERS)) {
    if (t.priceCents === valueCents) return t;
  }
  // Se teve bump ou não bateu exato, cai no mais próximo por baixo.
  const sorted = Object.values(TIERS).sort((a, b) => b.priceCents - a.priceCents);
  return sorted.find((t) => valueCents >= t.priceCents) || sorted[sorted.length - 1];
}

module.exports = { TIERS, BUMPS, DEFAULT_TIER, computeOrder, tierFromValueCents };
