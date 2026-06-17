'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { NutriWordmark } from '@/app/quiz/[step]/quiz-ui'

const TESTIMONIALS = [
  { initials: 'LM', color: 'bg-pink-400',    name: 'Laura M.',  country: 'México',   text: 'Bajé 6 kg en 5 semanas. Por fin un plan que se adapta a lo que como normalmente.' },
  { initials: 'CR', color: 'bg-blue-400',    name: 'Carlos R.', country: 'Colombia', text: 'Entendí exactamente cuánto comer para ganar músculo sin suplementos raros.' },
  { initials: 'AP', color: 'bg-emerald-400', name: 'Ana P.',    country: 'España',   text: 'Comida real, sin dietas locas. En 3 semanas ya notaba diferencia en el espejo.' },
]

const INCLUDES = [
  '📊 Perfil nutricional completo (IMC, TMB, TDEE)',
  '🍽️ Plan de alimentación semanal con porciones exactas',
  '🛒 Lista de compras optimizada',
  '📋 Guía de implementación paso a paso',
  '🔄 Sustituciones para adaptar a tu despensa',
]

export default function CheckoutPage() {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  // Pré-carrega o order em background para não atrasar o clique no CTA.
  const [orderId, setOrderId] = useState<string | null>(null)
  const [hotmartUrl, setHotmartUrl] = useState<string | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/checkout/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ include_bump: false }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.order_id) {
          setOrderId(data.order_id)
          setIdempotencyKey(data.idempotency_key)
          const base = process.env.NEXT_PUBLIC_HOTMART_CHECKOUT_URL ?? ''
          const step12 = sessionStorage.getItem('nutriplan_step_12')
          const lead = step12 ? (JSON.parse(step12) as Record<string, string>) : {}
          const params = new URLSearchParams()
          if (lead.email) params.set('email', lead.email)
          if (lead.name)  params.set('name',  lead.name)
          setHotmartUrl(`${base}?${params.toString()}`)
        }
      })
      .catch(() => {})
  }, [])

  async function handleCta() {
    if (state === 'loading') return
    setState('loading')

    if (orderId) {
      document.cookie = `nutriplan_order_id=${orderId}; path=/; max-age=3600; SameSite=Lax`
      if (idempotencyKey) {
        document.cookie = `nutriplan_order_key=${idempotencyKey}; path=/; max-age=3600; SameSite=Lax`
        sessionStorage.setItem('nutriplan_idempotency_key', idempotencyKey)
      }
    }

    if (process.env.NODE_ENV !== 'production' && orderId) {
      await fetch('/api/dev/simulate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      })
      router.push(`/exito?order=${orderId}`)
      return
    }

    if (hotmartUrl) {
      window.location.href = hotmartUrl
    } else {
      setState('error')
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          'linear-gradient(180deg, hsl(148,38%,90%) 0px, hsl(148,28%,95%) 90px, hsl(80,18%,97%) 220px)',
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-center border-b border-[#D4E8D0] bg-white/85 backdrop-blur-md">
        <NutriWordmark size="md" />
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-10 pt-8">
        <div className="w-full max-w-lg space-y-5 quiz-enter">

          {/* Título */}
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-black text-gray-900">Tu plan está listo</h1>
            <p className="text-sm text-muted-foreground">
              Completa el pago para recibir tu plan nutricional personalizado.
            </p>
          </div>

          {/* Social proof */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {TESTIMONIALS.map((t) => (
                  <div
                    key={t.initials}
                    className={`h-8 w-8 rounded-full border-2 border-white ${t.color} flex items-center justify-center text-xs font-bold text-white`}
                  >
                    {t.initials}
                  </div>
                ))}
                <div className="h-8 w-8 rounded-full border-2 border-white bg-[#E8F0E4] flex items-center justify-center text-xs font-semibold text-muted-foreground">
                  +
                </div>
              </div>
              <p className="text-sm font-medium">
                Más de <span className="text-primary font-bold">1.200 personas</span> ya tienen su plan
              </p>
            </div>

            <div className="space-y-2">
              {TESTIMONIALS.map((t) => (
                <div key={t.initials} className="rounded-xl border border-[#D8E8D4] bg-white px-4 py-3 text-sm shadow-sm">
                  <p className="text-gray-700">"{t.text}"</p>
                  <p className="mt-1 text-xs font-bold text-primary">— {t.name}, {t.country}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Lo que incluye */}
          <div className="rounded-2xl border border-[#D8E8D4] bg-white shadow-sm p-5 space-y-3">
            <p className="text-sm font-bold text-gray-900">¿Qué incluye tu plan?</p>
            <ul className="space-y-2">
              {INCLUDES.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          {state === 'error' && (
            <p className="text-center text-sm text-red-600">
              Error al preparar el pedido. Recarga la página e intenta de nuevo.
            </p>
          )}

          <button
            type="button"
            onClick={handleCta}
            disabled={state === 'loading'}
            className={[
              'flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-black text-white',
              'bg-primary shadow-[0_4px_20px_0_rgba(0,0,0,0.18)]',
              'hover:brightness-[1.04] hover:shadow-[0_6px_28px_0_rgba(0,0,0,0.22)]',
              'transition-all duration-150 active:scale-[0.99]',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
            ].join(' ')}
          >
            {state === 'loading' ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                Procesando…
              </>
            ) : (
              <>
                Completar mi compra
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-80">
                  <path d="M3.5 7.5H11.5M11.5 7.5L7.5 3.5M11.5 7.5L7.5 11.5"
                    stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            🔒 Pago 100% seguro procesado por Hotmart · Acceso inmediato tras la confirmación
          </p>

        </div>
      </main>
    </div>
  )
}
