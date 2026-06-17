'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizCard, QuizInput, QuizError } from './quiz-ui'

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

    let country: string | undefined
    try {
      const step7Raw = sessionStorage.getItem('nutriplan_step_7')
      const step7 = step7Raw ? (JSON.parse(step7Raw) as Record<string, unknown>) : {}
      country = step7.country as string | undefined
    } catch {}

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
        body: JSON.stringify({ email, name, country, policy_version: POLICY_VERSION, consent_text: CONSENT_TEXT }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error === 'country_not_set'
          ? 'El paso 7 no fue completado. Vuelve y selecciona tu país.'
          : 'Ocurrió un error. Intenta de nuevo.')
        return
      }

      router.push('/calculando' as never)
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <QuizLayout>
      {/* Barra de progresso — 100% no último paso */}
      <div className="space-y-2 px-0.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Paso {stepNumber} de {totalSteps}</span>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">100%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: '#C8E8BC' }}>
          <div className="h-full w-full rounded-full bg-primary" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <QuizCard>
          {/* Header especial para o último step */}
          <div className="text-center space-y-1 pb-1">
            <p className="text-3xl">🎉</p>
            <h1 className="text-xl font-bold text-gray-900">¡Ya casi listo!</h1>
            <p className="text-sm text-muted-foreground">
              Ingresa tus datos para ver tu plan nutricional personalizado.
            </p>
          </div>

          <div className="space-y-3">
            <QuizInput
              label="Tu nombre"
              type="text"
              required
              autoComplete="given-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="¿Cómo te llamas?"
            />
            <QuizInput
              label="Correo electrónico"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#DDE8D8] bg-[#F5FAF2] p-3">
            <input
              type="checkbox"
              required
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              {CONSENT_TEXT}{' '}
              <a href="/privacidad" target="_blank" className="underline hover:text-foreground">
                Leer política completa
              </a>
            </span>
          </label>

          {error && <QuizError message={error} />}
        </QuizCard>

        {/* CTA customizado para o step final */}
        <button
          type="submit"
          disabled={!consented || submitting}
          className={[
            'flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold text-white',
            'bg-primary shadow-md transition-all duration-150',
            'hover:brightness-105 hover:shadow-lg active:scale-[0.99]',
            'disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
          ].join(' ')}
        >
          {submitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
              Enviando…
            </>
          ) : (
            <>
              Ver mi plan nutricional
              <span className="opacity-70">→</span>
            </>
          )}
        </button>

        <p className="text-center text-xs text-muted-foreground">
          🔒 Tus datos están seguros y nunca serán compartidos.
        </p>
      </form>
    </QuizLayout>
  )
}
