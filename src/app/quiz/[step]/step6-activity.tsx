'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizOption, QuizCta, QuizError } from './quiz-ui'

const PRICED_COUNTRIES = new Set(['MX', 'CO', 'CL', 'ES'])

function toDbCountry(code: string | undefined): string {
  return code && PRICED_COUNTRIES.has(code) ? code : 'OTHER'
}

const LEVELS = [
  { id: 'sedentario',            factor: 1.2,   label: 'Sedentario',               desc: 'Poco o ningún ejercicio, trabajo de oficina',        emoji: '🛋️' },
  { id: 'ligeramente_activo',    factor: 1.375, label: 'Ligeramente activo',        desc: 'Ejercicio ligero 1–3 días por semana',               emoji: '🚶' },
  { id: 'moderadamente_activo',  factor: 1.55,  label: 'Moderadamente activo',      desc: 'Ejercicio moderado 3–5 días por semana',             emoji: '🏃' },
  { id: 'muy_activo',            factor: 1.725, label: 'Muy activo',                desc: 'Ejercicio intenso 6–7 días por semana',              emoji: '⚡' },
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
    } catch { return null }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function handleSelect(id: string) {
    const level = LEVELS.find((l) => l.id === id)!
    setSelected(id)
    sessionStorage.setItem('nutriplan_step_6', JSON.stringify({ activity_level: id, activity_factor: level.factor }))
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
        body: JSON.stringify({ step: 6, answers: { activity_level: selected, activity_factor: level.factor } }),
      })
      if (!res.ok) { setError(true); return }

      const dbCountry = toDbCountry(detectedCountry)
      sessionStorage.setItem('nutriplan_step_7', JSON.stringify({ country: dbCountry, country_detail: detectedCountry ?? null }))
      fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 7, answers: { country: dbCountry, country_detail: detectedCountry ?? null }, country: dbCountry }),
      }).catch(() => {})

      router.push('/quiz/8')
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const progress = Math.round((stepNumber / totalSteps) * 100)

  return (
    <QuizLayout>
      <QuizProgress step={stepNumber} total={totalSteps} pct={progress} />

      <QuizCard>
        <QuizHeader
          title="¿Cuál es tu nivel de actividad física?"
          subtitle="Sé honesto — esto determina directamente cuántas calorías necesitas cada día."
        />

        <div className="space-y-2.5">
          {LEVELS.map(({ id, label, desc, emoji }) => (
            <QuizOption
              key={id}
              label={label}
              desc={desc}
              emoji={emoji}
              selected={selected === id}
              onSelect={() => handleSelect(id)}
            />
          ))}
        </div>

        {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
      </QuizCard>

      <QuizCta onClick={handleContinue} disabled={!selected} loading={saving} />
    </QuizLayout>
  )
}
