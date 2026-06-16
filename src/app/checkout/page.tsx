'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type PriceData = {
  country: string
  currency: string
  plan: { product_code: string; local_price: number; period_version: string }
  bump: { product_code: string; local_price: number; period_version: string } | null
}

function formatPrice(amount: number, currency: string): string {
  const decimals = currency === 'EUR' || currency === 'USD' ? 2 : 0
  return new Intl.NumberFormat('es-419', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

export default function CheckoutPage() {
  const router = useRouter()
  const [priceData, setPriceData] = useState<PriceData | null>(null)
  const [includeBump, setIncludeBump] = useState(false)
  const [state, setState] = useState<'loading' | 'ready' | 'paying' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/checkout/resolve-price')
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setState('error')
          setErrorMsg('No encontramos tu sesión. Vuelve al quiz.')
        } else {
          setPriceData(data)
          setState('ready')
        }
      })
      .catch(() => {
        setState('error')
        setErrorMsg('Error de conexión. Recarga la página.')
      })
  }, [])

  async function handlePay() {
    if (!priceData || state !== 'ready') return
    setState('paying')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ include_bump: includeBump }),
      })
      const data = await res.json()

      if (!res.ok || !data.order_id) {
        setState('error')
        setErrorMsg('Error al crear el pedido. Intenta de nuevo.')
        return
      }

      sessionStorage.setItem('nutriplan_idempotency_key', data.idempotency_key)
      // Cookie persiste mesmo após redirect para Hotmart e de volta
      document.cookie = `nutriplan_order_id=${data.order_id}; path=/; max-age=3600; SameSite=Lax`
      document.cookie = `nutriplan_order_key=${data.idempotency_key}; path=/; max-age=3600; SameSite=Lax`

      if (process.env.NODE_ENV !== 'production') {
        // Dev: simulate payment immediately (marks order as paid, creates user)
        await fetch('/api/dev/simulate-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: data.order_id }),
        })
        router.push(`/exito?order=${data.order_id}`)
        return
      }

      // Prod: redirecionar para Hotmart
      const hotmartBase = process.env.NEXT_PUBLIC_HOTMART_CHECKOUT_URL!
      const step12 = sessionStorage.getItem('nutriplan_step_12')
      const lead = step12 ? JSON.parse(step12) : {}
      const params = new URLSearchParams()
      if (lead.email) params.set('email', lead.email)
      if (lead.name) params.set('name', lead.name)
      window.location.href = `${hotmartBase}?${params.toString()}`
    } catch {
      setState('error')
      setErrorMsg('Error de conexión. Intenta de nuevo.')
    }
  }

  if (state === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Preparando tu pedido…</p>
        </div>
      </main>
    )
  }

  if (state === 'error' && !priceData) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="text-3xl">⚠️</p>
          <p className="text-muted-foreground">{errorMsg}</p>
          <a href="/quiz/1" className="inline-block underline text-sm hover:text-foreground">
            Reiniciar quiz
          </a>
        </div>
      </main>
    )
  }

  if (!priceData) return null

  const total =
    includeBump && priceData.bump
      ? priceData.plan.local_price + priceData.bump.local_price
      : priceData.plan.local_price

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Tu plan está listo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Completa el pago para recibir tu plan nutricional personalizado.
          </p>
        </div>

        {/* Plan principal */}
        <div className="rounded-lg border p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">Plan Nutricional Personalizado</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Calculado según tu perfil, objetivo y restricciones
              </p>
            </div>
            <p className="font-bold text-lg whitespace-nowrap">
              {formatPrice(priceData.plan.local_price, priceData.currency)}
            </p>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 border-t pt-3">
            <li>✓ Plan de alimentación semanal con porciones exactas</li>
            <li>✓ Guía de implementación paso a paso</li>
            <li>✓ Lista de compras optimizada</li>
          </ul>
        </div>

        {/* Order bump — Plan de Entrenamiento */}
        {priceData.bump && (
          <button
            type="button"
            onClick={() => setIncludeBump(b => !b)}
            className={`w-full rounded-lg border-2 p-5 text-left transition-all ${
              includeBump ? 'border-primary bg-primary/5' : 'border-dashed border-border hover:border-muted-foreground'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 h-5 w-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                  includeBump ? 'border-primary bg-primary' : 'border-muted-foreground'
                }`}
              >
                {includeBump && (
                  <span className="text-primary-foreground text-xs leading-none font-bold">✓</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm">
                    Agregar Plan de Entrenamiento
                  </p>
                  <p className="font-bold text-sm whitespace-nowrap">
                    +{formatPrice(priceData.bump.local_price, priceData.currency)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Rutina adaptada a tu nivel, equipamiento y objetivo. Complemento ideal al plan nutricional.
                </p>
              </div>
            </div>
          </button>
        )}

        {/* Resumen + CTA */}
        <div className="rounded-lg border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Total a pagar</span>
            <span className="text-xl font-bold">
              {formatPrice(total, priceData.currency)}
            </span>
          </div>

          {state === 'error' && errorMsg && (
            <p className="text-sm text-destructive text-center">{errorMsg}</p>
          )}

          <button
            type="button"
            onClick={handlePay}
            disabled={state === 'paying'}
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-opacity"
          >
            {state === 'paying' ? 'Procesando…' : 'Completar pago'}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Pago 100% seguro · Acceso inmediato tras la confirmación
          </p>
        </div>
      </div>
    </main>
  )
}
