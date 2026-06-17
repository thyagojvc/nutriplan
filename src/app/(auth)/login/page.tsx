'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NutriWordmark } from '@/app/quiz/[step]/quiz-ui'

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

      // Dev: hashed_token retornado → autenticar direto sem e-mail
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

      setState('sent')
    } catch {
      setState('error')
      setErrorMsg('Error de conexión. Verifica tu internet.')
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

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">

        {/* ── Autenticando ────────────────────────────────────── */}
        {state === 'authenticating' && (
          <div className="flex flex-col items-center gap-3 quiz-enter">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
            <p className="text-sm text-muted-foreground">Autenticando…</p>
          </div>
        )}

        {/* ── E-mail enviado ──────────────────────────────────── */}
        {state === 'sent' && (
          <div className="w-full max-w-sm quiz-enter">
            <div className="rounded-2xl border border-[#D8E8D4] bg-white shadow-sm p-8 text-center space-y-4">
              <p className="text-4xl">📧</p>
              <div className="space-y-1.5">
                <h2 className="font-bold text-gray-900">Revisa tu correo</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Si encontramos una cuenta con ese correo, recibirás un
                  enlace de acceso en los próximos minutos.
                </p>
              </div>
              <button
                onClick={() => { setState('idle'); setEmail('') }}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Usar otro correo
              </button>
            </div>
          </div>
        )}

        {/* ── Formulario ──────────────────────────────────────── */}
        {state !== 'authenticating' && state !== 'sent' && (
          <div className="w-full max-w-sm space-y-5 quiz-enter">
            {/* Encabezado */}
            <div className="text-center space-y-1.5">
              <h1 className="text-2xl font-black text-gray-900">Accede a tu plan</h1>
              <p className="text-sm text-muted-foreground">
                Te enviamos un enlace al correo — sin contraseña.
              </p>
            </div>

            {/* Card del formulario */}
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-[#D8E8D4] bg-white shadow-sm p-6 space-y-4"
            >
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={[
                    'w-full rounded-xl border px-4 py-3 text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60',
                    'placeholder:text-muted-foreground transition-shadow',
                    'border-[#D8E8D4] bg-[#FAFCF8]',
                  ].join(' ')}
                />
              </div>

              {state === 'error' && (
                <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={state === 'loading' || !email}
                className={[
                  'flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white',
                  'bg-primary shadow-[0_4px_16px_0_rgba(0,0,0,0.15)]',
                  'hover:brightness-[1.04] hover:shadow-[0_6px_24px_0_rgba(0,0,0,0.2)]',
                  'transition-all duration-150 active:scale-[0.99]',
                  'disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
                ].join(' ')}
              >
                {state === 'loading' ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                    Enviando…
                  </>
                ) : (
                  <>
                    Enviar enlace de acceso
                    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" className="opacity-80">
                      <path d="M3.5 7.5H11.5M11.5 7.5L7.5 3.5M11.5 7.5L7.5 11.5"
                        stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              ¿Aún no tienes un plan?{' '}
              <a href="/" className="font-semibold text-primary underline hover:brightness-90">
                Comienza aquí
              </a>
            </p>
          </div>
        )}

      </main>
    </div>
  )
}
