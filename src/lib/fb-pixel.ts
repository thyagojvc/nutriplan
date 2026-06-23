// =============================================================================
// NutriPlan — Helper do Meta Pixel (eventos por etapa do funil)
// O pixel base (init + PageView) é carregado em app/layout.tsx. Aqui ficam os
// disparos de etapa para enxergar onde os cliques morrem: QuizStart, QuizComplete
// e ViewContent (preview). InitiateCheckout e Purchase são disparados pelo Hotmart.
// =============================================================================

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

/** Dispara um evento no Meta Pixel. No-op se o pixel ainda não carregou (SSR/adblock). */
export function trackPixel(
  event: string,
  params?: Record<string, unknown>,
  options?: { custom?: boolean },
): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
  window.fbq(options?.custom ? 'trackCustom' : 'track', event, params)
}

/**
 * Dispara um evento só uma vez por sessão (dedupe via sessionStorage), evitando
 * dobrar a contagem em re-render, StrictMode ou navegação de volta.
 */
export function trackPixelOnce(
  key: string,
  event: string,
  params?: Record<string, unknown>,
  options?: { custom?: boolean },
): void {
  if (typeof window === 'undefined') return
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    // sessionStorage indisponível — segue sem dedupe a perder o evento
  }
  trackPixel(event, params, options)
}
