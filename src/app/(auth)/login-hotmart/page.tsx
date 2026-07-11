'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NutriWordmark } from '@/app/quiz/[step]/quiz-ui'

// Login por senha — não faz parte do fluxo normal de clientes (que usa magic
// link em /login). Existe só para revisões de plataforma (ex: Hotmart) que
// exigem usuário/senha fixos para validar a Área de Membros Externa.
export default function LoginHotmartPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'loading' || !email || !password) return
    setState('loading')
    setErrorMsg(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setState('error')
      setErrorMsg('Correo o contraseña incorrectos.')
      return
    }

    router.push('/dashboard')
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          'linear-gradient(180deg, hsl(148,38%,90%) 0px, hsl(148,28%,95%) 90px, hsl(80,18%,97%) 220px)',
      }}
    >
      <header className="sticky top-0 z-20 flex h-14 items-center justify-center border-b border-[#D4E8D0] bg-white/85 backdrop-blur-md">
        <NutriWordmark size="md" />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-5 quiz-enter">
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-black text-gray-900">Acceso con contraseña</h1>
          </div>

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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[#D8E8D4] bg-[#FAFCF8] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[#D8E8D4] bg-[#FAFCF8] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60"
              />
            </div>

            {state === 'error' && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={state === 'loading' || !email || !password}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-black text-white shadow-[0_4px_16px_0_rgba(0,0,0,0.15)] hover:brightness-[1.04] transition-all duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {state === 'loading' ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
