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

export const PLATFORM_LABELS: Record<string, string> = { iOS: 'iPhone/iPad', Android: 'Android', Windows: 'Windows', Mac: 'Mac', Other: 'Otro' }
