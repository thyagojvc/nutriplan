// Labels compartilhados entre page.tsx (server) e os componentes client do
// painel /quiz-funnel (individuals-table.tsx). Extraído pra cá pra poder ser
// importado dos dois lados sem duplicar.

export const OFFER_LABELS: Record<string, string> = {
  PLAN_BASIC: 'Só o plano · 7 dias',
  PLAN_RECIPES: 'Plano + 28 Receitas Fitness',
  PLAN_TRAINING: 'Plano + Receitas + Treino',
  PLAN_STANDARD: 'Plano Standard (legado)',
  TRAINING_BUMP: 'Bump Treino (legado)',
  PLAN_4WEEKS: 'Transformación 4 semanas (legado)',
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pago',
  generating: 'Generando',
  needs_review: 'En revisión',
  delivered: 'Entregado',
  failed: 'Falló',
  refunded: 'Reembolsado',
}

export const DEVICE_LABELS: Record<string, string> = { mobile: 'Celular', tablet: 'Tablet', desktop: 'Computador' }

// Abas do app /mi-plan. O id é o que vai no evento (_ev_miplan_tab__lista);
// aqui vira nome legível pro painel. Aba nova = uma linha a mais aqui, senão
// ela aparece no painel com o id cru (que é o fallback, nunca some do relatório).
export const MIPLAN_TAB_LABELS: Record<string, string> = {
  plan: 'Calibra (entrada)',
  resultados: 'Ellas (prova social)',
  lista: 'Lista de compras',
  bonos: 'Bônus',
  entreno: 'Treino',
  desbloquear: 'Abrir (oferta)',
}

// Por qual das travas a aba de oferta apareceu. Diz o que de fato move ela:
// se "scroll" e "lock_tap" dominarem, o relógio de 35s está sobrando.
export const MIPLAN_UNLOCK_LABELS: Record<string, string> = {
  timer: 'Relógio (35s)',
  elapsed: 'Relógio já cumprido em visita anterior',
  scroll: 'Rolou o plano até 55%',
  lock_tap: 'Tocou um cadeado',
  cta: 'Botão da folha de desbloqueio',
}

export const PLATFORM_LABELS: Record<string, string> = { iOS: 'iPhone/iPad', Android: 'Android', Windows: 'Windows', Mac: 'Mac', Other: 'Otro' }
