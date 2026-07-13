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
  options?: { custom?: boolean; eventID?: string },
): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
  const trackOptions = options?.eventID ? { eventID: options.eventID } : undefined
  window.fbq(options?.custom ? 'trackCustom' : 'track', event, params, trackOptions)
}

/**
 * Passa dados do usuário (email, nome) para o pixel via Advanced Matching.
 * Deve ser chamado logo que o email estiver disponível (ex: preview page).
 * Chama fbq('init') novamente para atualizar os dados — isso é suportado pelo Meta.
 */
export async function setPixelUserData(
  email: string,
  firstName?: string,
  extra?: { gender?: string; country?: string },
): Promise<void> {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
  try {
    const normalize = (s: string) => s.toLowerCase().trim()
    const sha256 = async (s: string) => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    }
    const userData: Record<string, string> = { em: await sha256(normalize(email)) }
    if (firstName) userData.fn = await sha256(normalize(firstName))
    if (extra?.gender) {
      const ge = extra.gender === 'femenino' ? 'f' : extra.gender === 'masculino' ? 'm' : null
      if (ge) userData.ge = await sha256(ge)
    }
    if (extra?.country && extra.country !== 'OTHER') {
      userData.country = await sha256(normalize(extra.country))
    }
    window.fbq('init', '931028066102655', userData)
  } catch {
    // crypto.subtle indisponível (HTTP puro) ou fbq não carregado — sem-op seguro
  }
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

const FBCLID_KEY = 'nutriplan_fbclid'

/** Guarda o fbclid do clique do anúncio pra reusar em eventos posteriores (a
 *  URL só o traz na landing). Server usa como fallback do _fbc se o cookie faltar. */
function rememberFbclid(): string | undefined {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('fbclid')
    if (fromUrl) {
      sessionStorage.setItem(FBCLID_KEY, fromUrl)
      return fromUrl
    }
    return sessionStorage.getItem(FBCLID_KEY) ?? undefined
  } catch {
    return undefined
  }
}

/**
 * Espelha um evento de funil no pixel (client) E na Conversions API (server) com
 * o MESMO event_id, pra o Meta desduplicar e a nota de match quality subir (o
 * servidor tem IP/user-agent/fbc/external_id confiáveis que o pixel perde).
 * Fire-and-forget: o POST não bloqueia nada da navegação.
 */
export function trackDualOnce(
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
    // sessionStorage indisponível — segue sem dedupe (aceita risco de dobrar)
  }

  const eventId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${event}_${Date.now()}_${Math.random().toString(36).slice(2)}`

  trackPixel(event, params, { custom: options?.custom, eventID: eventId })

  const fbclid = rememberFbclid()
  fetch('/api/quiz/capi-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: event,
      event_id: eventId,
      is_custom: options?.custom ?? false,
      ...(fbclid ? { fbclid } : {}),
    }),
    keepalive: true,
  }).catch(() => {
    // rede/adblock derrubou o POST — o pixel client-side já saiu, sem prejuízo
  })
}
