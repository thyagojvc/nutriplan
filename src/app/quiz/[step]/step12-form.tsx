'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Versão e texto do consentimento — atualizar ao publicar nova política de privacidade
const POLICY_VERSION = 'v1.0'
const CONSENT_TEXT =
  'Acepto los Términos y Condiciones y la Política de Privacidad de NutriPlan. ' +
  'Autorizo el tratamiento de mis datos personales para la generación de mi plan nutricional.'

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step12Form({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [consented, setConsented] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!consented || submitting) return

    // Recuperar country do sessionStorage (salvo no step 7)
    let country: string | undefined
    try {
      const step7Raw = sessionStorage.getItem('nutriplan_step_7')
      const step7 = step7Raw ? (JSON.parse(step7Raw) as Record<string, unknown>) : {}
      country = step7.country as string | undefined
    } catch {
      // sessionStorage indisponível (SSR ou tab privada extremamente restrita)
    }

    if (!country) {
      setError('No pudimos recuperar tu país. Vuelve al paso 7 y continúa.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/quiz/submit-step12', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          country,
          policy_version: POLICY_VERSION,
          consent_text: CONSENT_TEXT,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))

        if (data?.error === 'country_not_set') {
          setError('El paso 7 no fue completado. Vuelve y selecciona tu país.')
        } else {
          setError('Ocurrió un error. Intenta de nuevo.')
        }
        return
      }

      // submit-step12 exitoso → tela de loading animada antes do checkout
      router.push('/calculando' as never)
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Barra de progresso */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Paso {stepNumber} de {totalSteps}</span>
            <span>100%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div className="h-2 w-full rounded-full bg-primary" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border p-6 space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">¡Ya casi listo!</h1>
            <p className="text-sm text-muted-foreground">
              Ingresa tus datos para recibir tu plan nutricional personalizado.
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="name" className="block text-sm font-medium">
              Nombre
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="given-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              {CONSENT_TEXT}{' '}
              <a href="/privacidad" target="_blank" className="underline hover:text-foreground">
                Leer política completa
              </a>
            </span>
          </label>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={!consented || submitting}
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? 'Enviando…' : 'Ver mi plan'}
          </button>
        </form>
      </div>
    </main>
  )
}
