'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizChip, QuizCta, QuizError } from './quiz-ui'

const OPTIONS = [
  { id: 'ninguna_condicion',  label: 'Ninguna condición médica', emoji: '💪' },
  { id: 'embarazada',         label: 'Embarazada o lactando',    emoji: '🤰' },
  { id: 'hipertension',       label: 'Hipertensión',             emoji: '💓' },
  { id: 'enfermedad_cardiaca',label: 'Enfermedad cardíaca',      emoji: '❤️' },
  { id: 'diabetes',           label: 'Diabetes',                  emoji: '🍬' },
  { id: 'otra_condicion',     label: 'Otra condición',            emoji: '📋' },
]

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step9Health({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const cached = sessionStorage.getItem('nutriplan_step_9')
      const parsed = cached ? (JSON.parse(cached) as { health?: string[] }) : {}
      return parsed.health ?? []
    } catch { return [] }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function toggle(id: string) {
    let next: string[]
    if (id === 'ninguna_condicion') {
      next = selected.includes('ninguna_condicion') ? [] : ['ninguna_condicion']
    } else {
      const without = selected.filter((x) => x !== 'ninguna_condicion')
      next = without.includes(id) ? without.filter((x) => x !== id) : [...without, id]
    }
    setSelected(next)
    sessionStorage.setItem('nutriplan_step_9', JSON.stringify({ health: next }))
    // Elegir la opción exclusiva "ninguna condición" avanza solo — menos fricción
    if (id === 'ninguna_condicion' && next.includes('ninguna_condicion')) submit(next)
  }

  async function submit(values: string[]) {
    if (values.length === 0 || saving) return
    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 9, answers: { health: values } }),
      })
      if (!res.ok) { setError(true); setSaving(false); return }
      router.push('/quiz/10')
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  const handleContinue = () => submit(selected)

  const progress = Math.round((stepNumber / totalSteps) * 100)

  return (
    <QuizLayout>
      <QuizProgress step={stepNumber} total={totalSteps} pct={progress} />

      <QuizCard>
        <QuizHeader
          title="¿Tienes alguna condición de salud?"
          subtitle="Tu plan incluirá ajustes específicos según tu situación. Todo se trata con discreción."
        />

        <div className="space-y-2">
          <QuizChip
            label="Ninguna condición médica"
            emoji="💪"
            selected={selected.includes('ninguna_condicion')}
            onToggle={() => toggle('ninguna_condicion')}
            fullWidth
          />
          <div className="grid grid-cols-2 gap-2">
            {OPTIONS.filter(o => o.id !== 'ninguna_condicion').map(({ id, label, emoji }) => (
              <QuizChip
                key={id}
                label={label}
                emoji={emoji}
                selected={selected.includes(id)}
                onToggle={() => toggle(id)}
              />
            ))}
          </div>
        </div>

        {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
      </QuizCard>

      <QuizCta onClick={handleContinue} disabled={selected.length === 0} loading={saving} />
    </QuizLayout>
  )
}
