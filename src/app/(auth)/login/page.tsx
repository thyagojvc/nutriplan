'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'authenticating' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'loading' || !email) return
    setState('loading')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/auth/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setState('error')
        setErrorMsg('Ocurrió un error. Intenta de nuevo.')
        return
      }

      // Dev: hashed_token retornado → autenticar direto sem precisar de e-mail
      if (data.dev_hashed_token) {
        setState('authenticating')
        const supabase = createClient()
        const { error } = await supabase.auth.verifyOtp({
          token_hash: data.dev_hashed_token,
          type: 'magiclink',
        })
        if (error) {
          setState('error')
          setErrorMsg('Error al autenticar. Intenta de nuevo.')
        } else {
          router.push('/dashboard')
        }
        return
      }

      // Prod: e-mail enviado via Resend (Fase B)
      setState('sent')
    } catch {
      setState('error')
      setErrorMsg('Error de conexión. Verifica tu internet.')
    }
  }

  if (state === 'authenticating') {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">Autenticando…</p>
        </div>
      </main>
    )
  }

  if (state === 'sent') {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="rounded-lg border p-6 text-center space-y-3">
            <p className="text-3xl">📧</p>
            <h2 className="font-semibold">Revisa tu correo</h2>
            <p className="text-sm text-muted-foreground">
              Si encontramos una cuenta con ese correo, recibirás un enlace de
              acceso en los próximos minutos.
            </p>
            <button
              onClick={() => { setState('idle'); setEmail('') }}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Usar otro correo
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">NutriPlan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresa tu correo para acceder a tu plan
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border p-6 space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {state === 'error' && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={state === 'loading' || !email}
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {state === 'loading' ? 'Enviando…' : 'Enviar enlace de acceso'}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          ¿Aún no tienes un plan?{' '}
          <a href="/quiz/1" className="underline hover:text-foreground">
            Comienza el quiz
          </a>
        </p>
      </div>
    </main>
  )
}
