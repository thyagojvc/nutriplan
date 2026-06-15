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

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1] ?? null
}

export function SuccessPoller() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [state, setState] = useState<PollerState>('polling')
  const isAuthenticating = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function stopPolling() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  useEffect(() => {
    // Dev: order vem na URL. Prod (Hotmart): vem do cookie gravado antes do redirect
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
          body: JSON.stringify({
            order_id: orderId,
            idempotency_key: idempotencyKey,
          }),
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
      // Limpar cookies de pedido
      document.cookie = 'nutriplan_order_id=; path=/; max-age=0'
      document.cookie = 'nutriplan_order_key=; path=/; max-age=0'
      router.push('/dashboard')
    }

    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
    timeoutRef.current = setTimeout(() => {
      stopPolling()
      setState('timeout')
    }, POLL_TIMEOUT_MS)

    poll()

    return () => stopPolling()
  }, [router, searchParams])

  if (state === 'no_key') {
    return <RecuperarPrompt message="No encontramos tu sesión de compra." />
  }

  if (state === 'auth_error') {
    return (
      <RecuperarPrompt message="Hubo un problema al crear tu acceso. Usa el enlace de recuperación." />
    )
  }

  if (state === 'timeout') {
    return (
      <RecuperarPrompt message="El proceso tardó más de lo esperado. Usa el enlace de recuperación." />
    )
  }

  return (
    <div className="w-full max-w-sm space-y-4 text-center">
      <div className="flex justify-center">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
      </div>
      <h1 className="text-xl font-semibold">
        {state === 'authenticating'
          ? 'Iniciando tu sesión…'
          : '¡Pago confirmado! Preparando tu acceso…'}
      </h1>
      <p className="text-sm text-muted-foreground">
        Esto puede tardar unos segundos. No cierres esta página.
      </p>
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
