'use client'

// =============================================================================
// Preço localizado + criação do pedido para o /mi-plan.
//
// Mesmas regras da /preview (deliberadamente duplicadas: o /mi-plan é um teste
// paralelo e não pode arrastar a página que converte hoje junto numa mudança).
// As duas que não podem divergir nunca:
//   1. O preço da oferta é o USD. É o que vai pro pedido, pro pixel e pra
//      Hotmart. O valor local é só tradução, calculado com o markup MEDIDO por
//      país (ver pricing/localize.ts), nunca com alíquota de imposto.
//   2. checkoutMode=10 é obrigatório na URL da Hotmart: é o modelo de checkout
//      onde os order bumps estão configurados no painel deles.
// =============================================================================

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  formatPrice, currencyForCountry, formatLocalTotal, formatLocalApprox,
} from '@/lib/pricing/localize'
import { trackPixel } from '@/lib/fb-pixel'
import { quizFetch } from '@/lib/quiz-session-client'

export const PRICE_USD = 9.90

const HOTMART_BASIC_URL = 'https://pay.hotmart.com/O106407229L?checkoutMode=10'

export type CheckoutState = 'idle' | 'loading' | 'error'

export function useOffer() {
  const router = useRouter()
  const [fx, setFx] = useState<{ currency: string; rate: number; country?: string }>({
    currency: 'USD', rate: 1,
  })
  const [lead, setLead] = useState<{ email?: string; name?: string }>({})
  const [state, setState] = useState<CheckoutState>('idle')

  // País vem do passo 7, igual ao checkout. O país entra no estado porque o
  // multiplicador da Hotmart é POR PAÍS e não por moeda (EC e PA usam USD e
  // cobram valores diferentes).
  useEffect(() => {
    let country: string | undefined
    try {
      const raw = sessionStorage.getItem('nutriplan_step_7')
      if (raw) {
        const parsed = JSON.parse(raw) as { country?: string; country_detail?: string }
        country = parsed.country_detail ?? parsed.country
      }
    } catch {}

    const currency = currencyForCountry(country)
    if (currency === 'USD') { setFx({ currency: 'USD', rate: 1, country }); return }

    fetch('/api/fx')
      .then((r) => r.json())
      .then((d) => {
        const rate = d?.rates?.[currency]
        if (typeof rate === 'number' && rate > 0) setFx({ currency, rate, country })
      })
      .catch(() => { /* mantém fallback USD */ })
  }, [])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('nutriplan_step_12')
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>
        setLead({ email: parsed.email, name: parsed.name })
      }
    } catch {}
  }, [])

  const price = useCallback((usd: number) => formatPrice(usd, 'USD', 1), [])

  /** O valor com imposto embutido que ela vai ver na Hotmart. null = sem medição. */
  const localPrice = useCallback(
    (usd: number) => formatLocalTotal(usd, fx.country, fx.currency, fx.rate),
    [fx],
  )

  /** Âncora de valor: conversão pura, sem markup, na mesma moeda do preço. */
  const anchorPrice = useCallback(
    (usd: number) => formatLocalApprox(usd, fx.currency, fx.rate) ?? formatPrice(usd, 'USD', 1),
    [fx],
  )

  /** Rótulo do botão: mostra o número que ela reconhece como "meu dinheiro". */
  const ctaLabel = useCallback(
    (usd: number, verb = 'Desbloquear mi plan por') => {
      const local = formatLocalTotal(usd, fx.country, fx.currency, fx.rate)
      if (!local) return `${verb} ${formatPrice(usd, 'USD', 1)} →`
      return `${verb} ${local} ${fx.currency} →`
    },
    [fx],
  )

  const startCheckout = useCallback(async () => {
    if (state === 'loading') return
    setState('loading')
    try {
      const r = await quizFetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_type: 'basic' }),
      })
      const d = await r.json()
      if (!d.order_id) { setState('error'); return }

      document.cookie = `nutriplan_order_id=${d.order_id}; path=/; max-age=3600; SameSite=Lax`
      if (d.idempotency_key) {
        document.cookie = `nutriplan_order_key=${d.idempotency_key}; path=/; max-age=3600; SameSite=Lax`
        sessionStorage.setItem('nutriplan_idempotency_key', d.idempotency_key)
      }

      sessionStorage.setItem('nutriplan_purchase_value', String(PRICE_USD))
      trackPixel(
        'InitiateCheckout',
        { value: PRICE_USD, currency: 'USD', content_name: 'NutriPlan' },
        { eventID: `initiate_checkout_${d.order_id}` },
      )

      if (process.env.NODE_ENV !== 'production') {
        await fetch('/api/dev/simulate-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: d.order_id }),
        })
        router.push(`/exito?order=${d.order_id}`)
        return
      }

      const params = new URLSearchParams()
      if (lead.email) params.set('email', lead.email)
      if (lead.name) params.set('name', lead.name)
      // sck volta no payload do webhook e casa a compra com o pedido.
      params.set('sck', d.order_id)
      window.location.href = `${HOTMART_BASIC_URL}&${params.toString()}`
    } catch {
      setState('error')
    }
  }, [state, lead, router])

  return { fx, price, localPrice, anchorPrice, ctaLabel, startCheckout, state }
}
