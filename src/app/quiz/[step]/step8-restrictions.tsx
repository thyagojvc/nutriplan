'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizChip, QuizCta, QuizError } from './quiz-ui'

const OPTIONS = [
  { id: 'ninguna',       label: 'Ninguna restricción', emoji: '✅', exclusive: true },
  { id: 'vegetariano',   label: 'Vegetariano',          emoji: '🥕' },
  { id: 'vegano',        label: 'Vegano',               emoji: '🌱' },
  { id: 'sin_gluten',    label: 'Sin gluten',           emoji: '🌾' },
  { id: 'sin_lactosa',   label: 'Sin lactosa',          emoji: '🥛' },
  { id: 'sin_mariscos',  label: 'Sin mariscos',         emoji: '🦐' },
  { id: 'sin_cerdo',     label: 'Sin cerdo',            emoji: '🐷' },
  { id: 'otra',          label: 'Otra',                 emoji: '📋' },
]

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step8Restrictions({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const cached = sessionStorage.getItem('nutriplan_step_8')
      const parsed = cached ? (JSON.parse(cached) as { restrictions?: string[] }) : {}
      return parsed.restrictions ?? []
    } catch { return [] }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function toggle(id: string) {
    let next: string[]
    if (id === 'ninguna') {
      next = selected.includes('ninguna') ? [] : ['ninguna']
    } else {
      const without = selected.filter((x) => x !== 'ninguna')
      next = without.includes(id) ? without.filter((x) => x !== id) : [...without, id]
    }
    setSelected(next)
    sessionStorage.setItem('nutriplan_step_8', JSON.stringify({ restrictions: next }))
    // Elegir la opción exclusiva "ninguna" avanza solo — menos fricción
    if (id === 'ninguna' && next.includes('ninguna')) submit(next)
  }

  async function submit(values: string[]) {
    if (values.length === 0 || saving) return
    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 8, answers: { restrictions: values } }),
      })
      if (!res.ok) { setError(true); setSaving(false); return }
      router.push('/quiz/9')
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
          title="¿Tienes restricciones alimentarias?"
          subtitle="Selecciona todas las que apliquen. Tu plan las respetará al 100%."
        />

        <div className="space-y-2">
          <QuizChip
            label="Ninguna restricción"
            emoji="✅"
            selected={selected.includes('ninguna')}
            onToggle={() => toggle('ninguna')}
            fullWidth
          />
          <div className="grid grid-cols-2 gap-2">
            {OPTIONS.filter(o => o.id !== 'ninguna').map(({ id, label, emoji }) => (
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
