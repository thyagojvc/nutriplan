'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizOption, QuizCta, QuizError } from './quiz-ui'

const OPTIONS = [
  { id: 'falta_tiempo',      label: 'Falta de tiempo',         desc: 'Mi agenda está siempre llena',                emoji: '⏰' },
  { id: 'falta_motivacion',  label: 'Falta de motivación',     desc: 'Me cuesta mantener la constancia',            emoji: '😔' },
  { id: 'no_se_que_comer',   label: 'No sé qué comer',         desc: 'Me pierdo entre tanta información',           emoji: '🤔' },
  { id: 'comer_fuera',       label: 'Comer fuera de casa',     desc: 'Trabajo o viajo mucho',                       emoji: '🍽️' },
  { id: 'presupuesto',       label: 'Presupuesto limitado',    desc: 'Quiero comer bien sin gastar mucho',          emoji: '💰' },
  { id: 'antojos',           label: 'Antojos y tentaciones',   desc: 'Me cuesta resistir ciertos alimentos',        emoji: '🍰' },
]

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step11Obstacle({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const cached = sessionStorage.getItem('nutriplan_step_11')
      const parsed = cached ? (JSON.parse(cached) as { obstacles?: string[] }) : {}
      return parsed.obstacles ?? []
    } catch { return [] }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      sessionStorage.setItem('nutriplan_step_11', JSON.stringify({ obstacles: next }))
      return next
    })
  }

  async function handleContinue() {
    if (selected.length === 0 || saving) return
    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 11, answers: { obstacles: selected } }),
      })
      if (!res.ok) { setError(true); return }
      router.push('/quiz/13')
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
          title="¿Cuáles son tus mayores obstáculos para mejorar tu alimentación?"
          subtitle="Selecciona todos los que apliquen — tu plan los tomará en cuenta."
        />

        <div className="space-y-2.5">
          {OPTIONS.map(({ id, label, desc, emoji }) => (
            <QuizOption
              key={id}
              label={label}
              desc={desc}
              emoji={emoji}
              selected={selected.includes(id)}
              onSelect={() => toggle(id)}
            />
          ))}
        </div>

        {selected.length > 0 && (
          <p className="text-center text-xs text-primary font-medium">
            {selected.length} seleccionado{selected.length !== 1 ? 's' : ''} ✓
          </p>
        )}

        {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
      </QuizCard>

      <QuizCta onClick={handleContinue} disabled={selected.length === 0} loading={saving}>
        Continuar
      </QuizCta>
    </QuizLayout>
  )
}
