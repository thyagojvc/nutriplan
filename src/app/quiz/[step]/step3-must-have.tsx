'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizInput, QuizCta, QuizError } from './quiz-ui'

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step3MustHave({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      const cached = sessionStorage.getItem('nutriplan_step_3')
      const parsed = cached ? (JSON.parse(cached) as { must_have?: string }) : {}
      return parsed.must_have ?? ''
    } catch { return '' }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function handleChange(v: string) {
    setValue(v)
    try {
      sessionStorage.setItem('nutriplan_step_3', JSON.stringify({ must_have: v }))
    } catch { /* segue sem cache local; o save-step no Continuar ainda persiste */ }
  }

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(false)
    const must_have = value.trim() || null
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 3, answers: { must_have } }),
      })
      if (!res.ok) { setError(true); return }
      router.push('/quiz/4')
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

      <form onSubmit={handleContinue} className="space-y-4">
        <QuizCard>
          <QuizHeader
            title="¿Hay algún alimento que no puedas dejar?"
            subtitle="Ese alimento que pase lo que pase siempre va a estar en tu día. Lo incluiremos en tu plan."
          />

          <QuizInput
            type="text"
            placeholder="Ej: café, chocolate, tortillas…"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            maxLength={100}
            autoFocus
          />

          <p className="rounded-xl bg-[#F0F8EC] border border-[#C8E4BC] px-4 py-3 text-xs text-[#2d6a2d]">
            💡 Si no tienes ninguno, puedes dejarlo en blanco — igual continuamos.
          </p>

          {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
        </QuizCard>

        <QuizCta type="submit" loading={saving} />
      </form>
    </QuizLayout>
  )
}
