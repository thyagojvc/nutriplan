'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PRICED_COUNTRIES = new Set(['MX', 'CO', 'CL', 'ES'])

function toDbCountry(code: string | undefined): string {
  return code && PRICED_COUNTRIES.has(code) ? code : 'OTHER'
}

const LEVELS = [
  {
    id: 'sedentario',
    factor: 1.2,
    label: 'Sedentario',
    desc: 'Poco o ningún ejercicio, trabajo de oficina',
  },
  {
    id: 'ligeramente_activo',
    factor: 1.375,
    label: 'Ligeramente activo',
    desc: 'Ejercicio ligero 1–3 días por semana',
  },
  {
    id: 'moderadamente_activo',
    factor: 1.55,
    label: 'Moderadamente activo',
    desc: 'Ejercicio moderado 3–5 días por semana',
  },
  {
    id: 'muy_activo',
    factor: 1.725,
    label: 'Muy activo',
    desc: 'Ejercicio intenso 6–7 días por semana',
  },
]

interface Props {
  stepNumber: number
  totalSteps: number
  detectedCountry?: string
}

export function Step6Activity({ stepNumber, totalSteps, detectedCountry }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem('nutriplan_step_6')
      const parsed = cached ? (JSON.parse(cached) as { activity_level?: string }) : {}
      return parsed.activity_level ?? null
    } catch {
      return null
    }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function handleSelect(id: string) {
    const level = LEVELS.find((l) => l.id === id)!
    setSelected(id)
    sessionStorage.setItem(
      'nutriplan_step_6',
      JSON.stringify({ activity_level: id, activity_factor: level.factor }),
    )
  }

  async function handleContinue() {
    if (!selected || saving) return
    const level = LEVELS.find((l) => l.id === selected)!
    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 6,
          answers: { activity_level: selected, activity_factor: level.factor },
        }),
      })
      if (!res.ok) { setError(true); return }

      // Salva país em background (sem await) para não atrasar a navegação.
      // sessionStorage já garante que step12 vai ler o valor mesmo antes da API responder.
      const dbCountry = toDbCountry(detectedCountry)
      sessionStorage.setItem('nutriplan_step_7', JSON.stringify({ country: dbCountry, country_detail: detectedCountry ?? null }))
      fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 7,
          answers: { country: dbCountry, country_detail: detectedCountry ?? null },
          country: dbCountry,
        }),
      }).catch(() => { /* silencioso — step 7 é fallback, o cookie de sessão persiste */ })

      router.push('/quiz/8')
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const progress = Math.round((stepNumber / totalSteps) * 100)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Paso {stepNumber} de {totalSteps}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border p-6 space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">¿Cuál es tu nivel de actividad física?</h1>
            <p className="text-sm text-muted-foreground">
              Sé honesto: esto afecta directamente tus calorías diarias.
            </p>
          </div>

          <div className="space-y-3">
            {LEVELS.map(({ id, label, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSelect(id)}
                className={[
                  'w-full rounded-lg border-2 px-4 py-3 text-left transition-colors',
                  selected === id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                ].join(' ')}
              >
                <p className={['text-sm font-medium', selected === id ? 'text-primary' : ''].join(' ')}>
                  {label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </button>
            ))}
          </div>

          {error && (
            <p className="text-sm text-destructive">Error al guardar. Intenta de nuevo.</p>
          )}
        </div>

        <button
          onClick={handleContinue}
          disabled={!selected || saving}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Continuar'}
        </button>
      </div>
    </main>
  )
}
