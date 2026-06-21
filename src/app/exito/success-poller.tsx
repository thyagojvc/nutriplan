'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, Clock, Zap, Lock } from 'lucide-react'

type PollerState = 'polling' | 'authenticating' | 'no_key' | 'auth_error' | 'timeout'

const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = 120_000

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1] ?? null
}

function getGoalLabel(): string {
  try {
    for (let n = 1; n <= 10; n++) {
      const raw = sessionStorage.getItem(`nutriplan_step_${n}`)
      if (!raw) continue
      const data = JSON.parse(raw) as Record<string, string>
      const goal = data.goal ?? ''
      if (!goal) continue
      if (goal === 'lose_fat' || goal === 'perder_peso') return 'perder grasa'
      if (goal === 'gain_muscle' || goal === 'ganar_masa') return 'ganar músculo'
      if (goal === 'maintain' || goal === 'mantener') return 'mantener tu peso'
      if (goal === 'health_energy') return 'mejorar tu salud y energía'
    }
  } catch {}
  return 'alcanzar tu objetivo'
}

export function SuccessPoller() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<PollerState>('polling')
  const [goalLabel] = useState(getGoalLabel)
  const isAuthenticating = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function stopPolling() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  useEffect(() => {
    const orderId = searchParams.get('order') ?? getCookie('nutriplan_order_id')
    const idempotencyKey =
      sessionStorage.getItem('nutriplan_idempotency_key') ?? getCookie('nutriplan_order_key')

    if (!orderId || !idempotencyKey) {
      setState('no_key')
      return
    }

    const supabase = createClient()

    async function poll() {
      if (isAuthenticating.current) return

      let response: Response
      try {
        response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId, idempotency_key: idempotencyKey }),
        })
      } catch {
        return
      }

      if (response.status === 202) return
      if (!response.ok) { stopPolling(); setState('auth_error'); return }

      const { hashed_token } = await response.json()
      isAuthenticating.current = true
      stopPolling()
      setState('authenticating')

      const { error } = await supabase.auth.verifyOtp({
        token_hash: hashed_token,
        type: 'magiclink',
      })

      if (error) { isAuthenticating.current = false; setState('auth_error'); return }

      sessionStorage.removeItem('nutriplan_idempotency_key')
      document.cookie = 'nutriplan_order_id=; path=/; max-age=0'
      document.cookie = 'nutriplan_order_key=; path=/; max-age=0'
      router.push('/dashboard')
    }

    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
    timeoutRef.current = setTimeout(() => { stopPolling(); setState('timeout') }, POLL_TIMEOUT_MS)
    poll()

    return () => stopPolling()
  }, [router, searchParams])

  if (state === 'no_key') {
    return (
      <RecuperarPrompt message="Tu compra fue procesada con éxito. Solo necesitamos enviarte el enlace de acceso." />
    )
  }
  if (state === 'auth_error') {
    return (
      <RecuperarPrompt message="Tu compra está confirmada. Usa el enlace de recuperación para ingresar a tu plan." />
    )
  }
  if (state === 'timeout') {
    return (
      <RecuperarPrompt message="Tu plan está listo. Usa el enlace de recuperación para acceder." />
    )
  }

  const steps: { label: string; done: boolean }[] = [
    { label: 'Pago confirmado', done: true },
    {
      label: state === 'authenticating' ? 'Plan generado' : 'Generando tu plan…',
      done: state === 'authenticating',
    },
    {
      label: state === 'authenticating' ? 'Iniciando tu sesión…' : 'Preparando tu acceso',
      done: false,
    },
  ]

  return (
    <div className="w-full max-w-sm space-y-8 text-center">

      {/* Hero — checkmark animado */}
      <div className="flex justify-center">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-[0_8px_32px_rgba(15,110,86,0.30)]">
          <Check className="h-9 w-9 text-white" strokeWidth={3} />
          <span
            className="absolute inset-0 rounded-full animate-ping bg-primary/20"
            style={{ animationDuration: '2s' }}
          />
        </div>
      </div>

      {/* Headline personalizada */}
      <div className="space-y-1.5">
        <h1 className="text-2xl font-black text-gray-900 leading-tight font-display">
          ¡Tu compra fue confirmada!
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Estamos creando tu plan para{' '}
          <strong className="text-gray-700">{goalLabel}</strong>.
          <br />
          No cierres esta página.
        </p>
      </div>

      {/* Progress steps */}
      <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 text-left space-y-4 shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className={[
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors duration-300',
                step.done
                  ? 'bg-primary shadow-[0_2px_8px_rgba(15,110,86,0.25)]'
                  : 'border-2 border-[#D8E8D4] bg-white',
              ].join(' ')}
            >
              {step.done
                ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                : <span className="h-2 w-2 rounded-full bg-[#D8E8D4] animate-pulse" />
              }
            </div>
            <span
              className={[
                'text-sm transition-colors duration-300',
                step.done ? 'font-semibold text-gray-900' : 'text-muted-foreground',
              ].join(' ')}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Selos de confiança */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Pago seguro</span>
        <span className="h-3 w-px bg-border" />
        <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Acceso inmediato</span>
        <span className="h-3 w-px bg-border" />
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Tardamos unos segundos</span>
      </div>

    </div>
  )
}

function RecuperarPrompt({ message }: { message: string }) {
  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border border-[#D8E8D4]">
          <Check className="h-8 w-8 text-primary" strokeWidth={2.5} />
        </div>
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold text-gray-900 font-display">Compra confirmada ✓</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
          {message}
        </p>
      </div>
      <a
        href="/recuperar"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-black text-white shadow-[0_4px_20px_rgba(15,110,86,0.28)] hover:brightness-105 transition-all"
      >
        Acceder a mi plan →
      </a>
    </div>
  )
}
