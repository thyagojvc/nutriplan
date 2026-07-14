'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizNumberField, QuizCta, QuizError } from './quiz-ui'

interface PhysicalData {
  age: number
  weight_kg: number
  height_cm: number
}

interface Props {
  stepNumber: number
  totalSteps: number
}

const DEFAULTS: PhysicalData = { age: 30, weight_kg: 70, height_cm: 165 }

export function Step5Physical({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  // QuizNumberField sempre clampa entre min/max; min de edad = 18 já exclui
  // menores de idade estruturalmente, sem precisar de tela de bloqueio depois
  // do envio (o que existia antes, quando o campo era texto livre).
  const [data, setData] = useState<PhysicalData>(() => {
    if (typeof window === 'undefined') return DEFAULTS
    try {
      const cached = sessionStorage.getItem('nutriplan_step_5')
      const parsed = cached ? (JSON.parse(cached) as Partial<PhysicalData>) : {}
      return {
        age: parsed.age ?? DEFAULTS.age,
        weight_kg: parsed.weight_kg ?? DEFAULTS.weight_kg,
        height_cm: parsed.height_cm ?? DEFAULTS.height_cm,
      }
    } catch { return DEFAULTS }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function handleChange(field: keyof PhysicalData, val: number) {
    const next = { ...data, [field]: val }
    setData(next)
    sessionStorage.setItem('nutriplan_step_5', JSON.stringify(next))
  }

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    setSaving(true)
    setError(false)
    // Garante que o sessionStorage tenha os valores mesmo se a pessoa aceitar
    // os padrões sem editar nenhum campo (handleChange nunca dispara nesse
    // caso). Sem isso, a confirmação do próximo passo (metabolismo basal)
    // fica sem dado pra ler.
    try {
      sessionStorage.setItem('nutriplan_step_5', JSON.stringify(data))
    } catch { /* segue sem cache local; o save-step abaixo ainda persiste no banco */ }
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 5, answers: data }),
      })
      if (!res.ok) { setError(true); return }
      router.push('/quiz/2') // → objetivo (URL 2 renderiza Step2Goal)
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
            title="Tus datos físicos"
            subtitle="Los usaremos para calcular tus calorías y macros exactos. Nadie más los verá."
          />

          <div className="space-y-5">
            <QuizNumberField
              label="¿Cuántos años tienes?"
              unit="años"
              min={18}
              max={80}
              value={data.age}
              onChange={(v) => handleChange('age', v)}
            />
            <QuizNumberField
              label="¿Cuál es tu peso hoy?"
              unit="kg"
              min={40}
              max={180}
              value={data.weight_kg}
              onChange={(v) => handleChange('weight_kg', v)}
              hint="Sin juicios, es solo tu punto de partida."
            />
            <QuizNumberField
              label="¿Cuál es tu altura?"
              unit="cm"
              min={130}
              max={210}
              value={data.height_cm}
              onChange={(v) => handleChange('height_cm', v)}
            />
          </div>

          {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
        </QuizCard>

        <QuizCta type="submit" loading={saving} />
      </form>
    </QuizLayout>
  )
}
