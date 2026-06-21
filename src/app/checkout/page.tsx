'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart2, Utensils, ShoppingCart, BookOpen, RefreshCw, FileDown, GraduationCap } from 'lucide-react'
import { NutriWordmark } from '@/app/quiz/[step]/quiz-ui'

const TESTIMONIALS = [
  { initials: 'LM', color: 'bg-pink-400',    name: 'Laura M.',  country: 'México',   text: 'Bajé 6 kg en 5 semanas. Por fin un plan que se adapta a lo que como normalmente.' },
  { initials: 'SR', color: 'bg-violet-400',  name: 'Sara R.',   country: 'Colombia', text: 'Ya no cuento calorías. El plan me dice exactamente qué comer y en 4 semanas noto la ropa más suelta.' },
  { initials: 'AP', color: 'bg-emerald-400', name: 'Ana P.',    country: 'España',   text: 'Comida real, sin dietas locas. En 3 semanas ya notaba diferencia en el espejo.' },
]

const INCLUDES = [
  { Icon: BarChart2,    text: 'Tu perfil nutricional exacto (IMC, TMB, TDEE)' },
  { Icon: Utensils,     text: 'Plan de 7 días personalizado con comidas y porciones exactas' },
  { Icon: ShoppingCart, text: 'Lista de compras optimizada para tu plan' },
  { Icon: BookOpen,     text: 'Guía de implementación paso a paso' },
  { Icon: RefreshCw,    text: 'Sustituciones para adaptar a lo que tienes en casa' },
  { Icon: FileDown,     text: 'PDF descargable para consultar cuando quieras' },
  { Icon: GraduationCap, text: 'Metodología diseñada y validada por nutriólogos certificados' },
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
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3.5 py-1 text-xs font-semibold text-primary mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Último paso
            </div>
            <h1 className="text-2xl font-black text-gray-900 font-display">Tu plan está calculado<br />y listo para ti</h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              Completa el acceso y en minutos recibes tu plan nutricional personalizado en tu correo.
            </p>
          </div>

          {/* Urgência */}
          <div className="flex items-center justify-center gap-2 rounded-xl border border-[#FBE7DF] bg-[#FFF5F0] px-4 py-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D85A30] animate-pulse" />
            <span className="text-sm font-semibold text-[#993C1D]">Tu precio especial está reservado</span>
          </div>

          {/* Social proof */}
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
              Más de <span className="text-primary font-bold">1.800 mujeres</span> ya tienen su plan
            </p>
          </div>

          {/* Lo que incluye */}
          <div className="rounded-2xl border border-[#D8E8D4] bg-white shadow-sm p-5 space-y-3">
            <p className="text-sm font-bold text-gray-900">¿Qué incluye tu plan?</p>
            <ul className="space-y-2">
              {INCLUDES.map(({ Icon, text }) => (
                <li key={text} className="flex items-start gap-2 text-sm text-gray-700">
                  <Icon className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  <span>{text}</span>
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
              'bg-[#D85A30] shadow-[0_4px_20px_0_rgba(216,90,48,0.38)]',
              'hover:shadow-[0_6px_28px_0_rgba(216,90,48,0.48)] hover:brightness-[1.05]',
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
                Completar mi compra — $9.90 USD
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-80">
                  <path d="M3.5 7.5H11.5M11.5 7.5L7.5 3.5M11.5 7.5L7.5 11.5"
                    stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            🔒 Pago seguro por Hotmart · Acceso inmediato · Garantía de 30 días
          </p>

        </div>
      </main>
    </div>
  )
}
