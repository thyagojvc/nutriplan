'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type PollerState =
  | 'polling'
  | 'authenticating'
  | 'no_key'
  | 'auth_error'
  | 'timeout'

const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = 120_000
const ANIMATION_MS = 20_000

const PHASES = [
  'Analizando tus preferencias alimentarias…',
  'Calculando tu metabolismo basal…',
  'Distribuyendo tus macronutrientes…',
  'Ajustando a tu objetivo personal…',
  'Armando tu ciclo de 7 días…',
  'Generando tu lista de compras…',
  'Revisando restricciones y alergias…',
  '¡Tu plan personalizado está listo!',
]

const PHASE_DURATION = ANIMATION_MS / PHASES.length // 2500 ms cada

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1] ?? null
}

export function SuccessPoller() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [state, setState] = useState<PollerState>('polling')
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [animationDone, setAnimationDone] = useState(false)
  const pendingNav = useRef(false)
  const isAuthenticating = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Animação de 20 segundos
  useEffect(() => {
    const start = Date.now()
    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min((elapsed / ANIMATION_MS) * 100, 100)
      setProgress(pct)
      setPhaseIndex(Math.min(Math.floor(elapsed / PHASE_DURATION), PHASES.length - 1))

      if (elapsed >= ANIMATION_MS) {
        clearInterval(tick)
        setAnimationDone(true)
        if (pendingNav.current) router.push('/dashboard')
      }
    }, 80)
    return () => clearInterval(tick)
  }, [router])

  function stopPolling() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  useEffect(() => {
    const orderId =
      searchParams.get('order') ?? getCookie('nutriplan_order_id')
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

      if (!response.ok) {
        stopPolling()
        setState('auth_error')
        return
      }

      const { hashed_token } = await response.json()

      isAuthenticating.current = true
      stopPolling()
      setState('authenticating')

      const { error } = await supabase.auth.verifyOtp({
        token_hash: hashed_token,
        type: 'magiclink',
      })

      if (error) {
        isAuthenticating.current = false
        setState('auth_error')
        return
      }

      sessionStorage.removeItem('nutriplan_idempotency_key')
      document.cookie = 'nutriplan_order_id=; path=/; max-age=0'
      document.cookie = 'nutriplan_order_key=; path=/; max-age=0'

      // Se a animação já terminou navega agora; senão deixa o tick navegar
      if (animationDone) {
        router.push('/dashboard')
      } else {
        pendingNav.current = true
      }
    }

    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
    timeoutRef.current = setTimeout(() => {
      stopPolling()
      setState('timeout')
    }, POLL_TIMEOUT_MS)

    poll()

    return () => stopPolling()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, searchParams])

  if (state === 'no_key') {
    return <RecuperarPrompt message="No encontramos tu sesión de compra." />
  }
  if (state === 'auth_error') {
    return <RecuperarPrompt message="Hubo un problema al crear tu acceso. Usa el enlace de recuperación." />
  }
  if (state === 'timeout') {
    return <RecuperarPrompt message="El proceso tardó más de lo esperado. Usa el enlace de recuperación." />
  }

  const circumference = 2 * Math.PI * 34

  return (
    <div className="w-full max-w-sm space-y-8 text-center">
      {/* Círculo de progresso */}
      <div className="flex justify-center">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
          <circle
            cx="40" cy="40" r="34" fill="none"
            stroke="hsl(var(--primary))" strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress / 100)}
            style={{ transition: 'stroke-dashoffset 0.08s linear' }}
          />
        </svg>
      </div>

      <div className="space-y-3">
        <h1 className="text-xl font-bold">Preparando tu plan personalizado</h1>
        <p className="text-sm text-primary font-medium min-h-[1.5rem] transition-all duration-500">
          {PHASES[phaseIndex]}
        </p>
      </div>

      {/* Dots de progresso */}
      <div className="flex justify-center gap-2">
        {PHASES.map((_, i) => (
          <div
            key={i}
            className={[
              'h-2 w-2 rounded-full transition-all duration-300',
              i <= phaseIndex ? 'bg-primary scale-110' : 'bg-muted',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Barra de progresso */}
      <div className="space-y-1">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${progress}%`, transition: 'width 0.08s linear' }}
          />
        </div>
        <p className="text-xs text-muted-foreground">Esto puede tardar unos segundos. No cierres esta página.</p>
      </div>
    </div>
  )
}

function RecuperarPrompt({ message }: { message: string }) {
  return (
    <div className="w-full max-w-sm space-y-4 text-center">
      <h1 className="text-xl font-semibold">Algo salió mal</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <a
        href="/recuperar"
        className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Recuperar acceso
      </a>
    </div>
  )
}
