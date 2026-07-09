'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizOption, QuizCta, QuizError } from './quiz-ui'

const OPTIONS = [
  { id: 'masculino', label: 'Masculino', emoji: '👨' },
  { id: 'femenino',  label: 'Femenino',  emoji: '👩' },
]

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step4Sex({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem('nutriplan_step_4')
      const parsed = cached ? (JSON.parse(cached) as { sex?: string }) : {}
      return parsed.sex ?? null
    } catch { return null }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function handleSelect(id: string) {
    setSelected(id)
    sessionStorage.setItem('nutriplan_step_4', JSON.stringify({ sex: id }))
    // Escolha única: avança direto, sem exigir o clique em Continuar
    submit(id)
  }

  async function submit(sex: string) {
    if (!sex || saving) return
    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 4, answers: { sex } }),
      })
      if (!res.ok) { setError(true); setSaving(false); return }
      router.push('/quiz/1') // → alimentos favoritos
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
          title="¿Cuál es tu sexo biológico?"
          subtitle="Lo necesitamos para calcular tu metabolismo basal con precisión."
        />

        <div className="grid grid-cols-2 gap-3">
          {OPTIONS.map(({ id, label, emoji }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleSelect(id)}
              className={[
                'flex flex-col items-center gap-2 rounded-xl border py-5 text-center transition-all duration-150',
                selected === id
                  ? 'border-primary bg-[#EAF6E4] shadow-sm'
                  : 'border-[#DDE8D8] bg-white hover:border-primary/50 hover:bg-[#F3FAF0]',
              ].join(' ')}
            >
              <span className="text-3xl">{emoji}</span>
              <span className={['text-sm font-semibold', selected === id ? 'text-primary' : 'text-gray-800'].join(' ')}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
      </QuizCard>

      <QuizCta onClick={handleContinue} disabled={!selected} loading={saving} />
    </QuizLayout>
  )
}
