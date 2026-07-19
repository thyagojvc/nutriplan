'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizOption, QuizCta, QuizError } from './quiz-ui'

const GOALS = [
  { id: 'perder_peso',   label: 'Perder peso',          desc: 'Quiero reducir mi grasa corporal',                     emoji: '🔥' },
  { id: 'mantener',      label: 'Mantener mi peso',      desc: 'Quiero mantenerme saludable sin cambiar mi peso',      emoji: '⚖️' },
  { id: 'ganar_masa',    label: 'Ganar masa muscular',   desc: 'Quiero aumentar mi masa muscular',                     emoji: '💪' },
]

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step2Goal({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem('nutriplan_step_2')
      const parsed = cached ? (JSON.parse(cached) as { goal?: string }) : {}
      return parsed.goal ?? null
    } catch { return null }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  // Confirma os alimentos favoritos (respondido no passo anterior) antes da pergunta atual.
  const [likesCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    try {
      const cached = sessionStorage.getItem('nutriplan_step_1')
      const parsed = cached ? (JSON.parse(cached) as { likes?: string[] }) : {}
      return parsed.likes?.length ?? 0
    } catch { return 0 }
  })

  function handleSelect(id: string) {
    setSelected(id)
    // sessionStorage pode falhar (ex: navegador interno do Instagram/Facebook
    // com armazenamento restrito) — não pode bloquear o avanço se isso acontecer.
    try {
      sessionStorage.setItem('nutriplan_step_2', JSON.stringify({ goal: id }))
    } catch { /* segue sem cache local; o save-step ainda persiste no banco */ }
    // Escolha única: avança direto, sem exigir o clique em Continuar
    submit(id)
  }

  async function submit(goal: string) {
    if (!goal || saving) return
    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 2, answers: { goal } }),
      })
      if (!res.ok) { setError(true); setSaving(false); return }
      router.push('/quiz/6') // → nivel de actividad
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  const handleContinue = () => { if (selected) submit(selected) }

  const progress = Math.round((stepNumber / totalSteps) * 100)

  return (
    <QuizLayout>
      <QuizProgress step={stepNumber} total={totalSteps} pct={progress} />

      <QuizCard>
        <QuizHeader
          confirm={
            likesCount > 0
              ? `${likesCount} alimento${likesCount !== 1 ? 's' : ''} favorito${likesCount !== 1 ? 's' : ''} guardado${likesCount !== 1 ? 's' : ''}. Ahora, tu objetivo.`
              : 'Preferencias registradas. Ahora, tu objetivo.'
          }
          title="¿Cuál es tu objetivo principal?"
          subtitle="Tu plan será completamente diferente según lo que elijas."
        />

        <div className="space-y-2.5">
          {GOALS.map(({ id, label, desc, emoji }) => (
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
