'use client'

import { useEffect, useState } from 'react'
import { NutriWordmark } from '@/app/quiz/[step]/quiz-ui'

// Página intermediária entre o e-mail e o Supabase.
// O botão do e-mail aponta aqui. O scanner de phishing do Gmail/Outlook
// segue o link, mas NÃO executa JavaScript — então o token nunca é consumido.
// Só o usuário real clica no botão abaixo, que aí sim lê o hash e redireciona.
export default function MagicLandingPage() {
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) { setError(true); return }
    try {
      const decoded = atob(hash)
      setLink(decoded)
    } catch {
      setError(true)
    }
  }, [])

  function handleClick() {
    if (link) window.location.href = link
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
        <div className="w-full max-w-sm quiz-enter">
          {error ? (
            <div className="rounded-2xl border border-red-100 bg-white shadow-sm p-8 text-center space-y-4">
              <p className="text-3xl">⚠️</p>
              <h2 className="font-bold text-gray-900">Enlace no válido</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Este enlace ya no funciona. Por favor, solicita un nuevo enlace
                desde la página de acceso.
              </p>
              <a
                href="/login"
                className="inline-block mt-2 text-sm font-semibold text-primary underline"
              >
                Ir a la página de acceso
              </a>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#D8E8D4] bg-white shadow-sm p-8 text-center space-y-5">
              <p className="text-4xl">🔑</p>
              <div className="space-y-1.5">
                <h1 className="text-xl font-black text-gray-900">
                  Accede a tu plan
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Haz clic en el botón para entrar directamente. Sin contraseña.
                </p>
              </div>

              <button
                onClick={handleClick}
                disabled={!link}
                className={[
                  'flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white',
                  'bg-primary shadow-[0_4px_16px_0_rgba(0,0,0,0.15)]',
                  'hover:brightness-[1.04] hover:shadow-[0_6px_24px_0_rgba(0,0,0,0.2)]',
                  'transition-all duration-150 active:scale-[0.99]',
                  'disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
                ].join(' ')}
              >
                {!link ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                    Cargando…
                  </>
                ) : (
                  <>
                    Ver mi plan
                    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" className="opacity-80">
                      <path d="M3.5 7.5H11.5M11.5 7.5L7.5 3.5M11.5 7.5L7.5 11.5"
                        stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </button>

              <p className="text-xs text-muted-foreground">
                El enlace es de uso único y personal.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
