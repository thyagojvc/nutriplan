'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizInput, QuizCta, QuizError } from './quiz-ui'

const EXPERIENCE_LABEL: Record<string, string> = {
  no_ejercicio: 'Registramos que no haces ejercicio hoy.',
  principiante: 'Nivel principiante registrado.',
  intermedio: 'Nivel intermedio registrado.',
  avanzado: 'Nivel avanzado registrado.',
}

interface PhysicalData {
  age: string
  weight_kg: string
  height_cm: string
}

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step5Physical({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [data, setData] = useState<PhysicalData>(() => {
    if (typeof window === 'undefined') return { age: '', weight_kg: '', height_cm: '' }
    try {
      const cached = sessionStorage.getItem('nutriplan_step_5')
      const parsed = cached ? (JSON.parse(cached) as Partial<PhysicalData>) : {}
      return {
        age: String(parsed.age ?? ''),
        weight_kg: String(parsed.weight_kg ?? ''),
        height_cm: String(parsed.height_cm ?? ''),
      }
    } catch { return { age: '', weight_kg: '', height_cm: '' } }
  })

  const [ageBlocked, setAgeBlocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  // Confirma a experiência de exercício respondida no passo anterior (URL 10).
  const [exerciseConfirm] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem('nutriplan_step_10')
      const parsed = cached ? (JSON.parse(cached) as { experience?: string }) : {}
      return parsed.experience ? EXPERIENCE_LABEL[parsed.experience] ?? null : null
    } catch { return null }
  })

  function handleChange(field: keyof PhysicalData, val: string) {
    const next = { ...data, [field]: val }
    setData(next)
    setAgeBlocked(false)
    sessionStorage.setItem('nutriplan_step_5', JSON.stringify(next))
  }

  const age = parseInt(data.age, 10)
  const weight = parseFloat(data.weight_kg)
  const height = parseFloat(data.height_cm)

  const isValid =
    !isNaN(age) && age >= 1 && age <= 100 &&
    !isNaN(weight) && weight >= 40 && weight <= 250 &&
    !isNaN(height) && height >= 130 && height <= 220

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || saving) return

    if (age < 18) {
      setAgeBlocked(true)
      return
    }

    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 5, answers: { age, weight_kg: weight, height_cm: height } }),
      })
      if (!res.ok) { setError(true); return }
      router.push('/quiz/13') // → incómodo corporal
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const progress = Math.round((stepNumber / totalSteps) * 100)

  if (ageBlocked) {
    return (
      <QuizLayout>
        <QuizCard>
          <div className="py-4 text-center space-y-4">
            <p className="text-5xl">🚫</p>
            <h1 className="text-xl font-bold text-gray-900">Lo sentimos</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              NutriPlan es exclusivo para personas mayores de 18 años.
              No podemos continuar con tu solicitud.
            </p>
          </div>
        </QuizCard>
      </QuizLayout>
    )
  }

  return (
    <QuizLayout>
      <QuizProgress step={stepNumber} total={totalSteps} pct={progress} />

      <form onSubmit={handleContinue} className="space-y-4">
        <QuizCard>
          <QuizHeader
            confirm={exerciseConfirm ? `${exerciseConfirm} Ahora tus datos físicos.` : undefined}
            title="Tus datos físicos"
            subtitle="Los usaremos para calcular tus calorías y macros exactos. Nadie más los verá."
          />

          <div className="space-y-4">
            <QuizInput
              label="Edad (años)"
              type="number"
              min={1}
              max={100}
              placeholder="Ej: 28"
              value={data.age}
              onChange={(e) => handleChange('age', e.target.value)}
              autoFocus
              hint={data.age !== '' && !isNaN(parseInt(data.age)) && parseInt(data.age) < 18
                ? 'Debes tener al menos 18 años.'
                : undefined}
            />

            <div className="grid grid-cols-2 gap-3">
              <QuizInput
                label="Peso (kg)"
                type="number"
                min={40}
                max={250}
                step={0.1}
                placeholder="Ej: 70"
                value={data.weight_kg}
                onChange={(e) => handleChange('weight_kg', e.target.value)}
              />
              <QuizInput
                label="Altura (cm)"
                type="number"
                min={130}
                max={220}
                placeholder="Ej: 170"
                value={data.height_cm}
                onChange={(e) => handleChange('height_cm', e.target.value)}
              />
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Cuanto más exactos sean tus datos, más preciso será tu plan 🎯
          </p>

          {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
        </QuizCard>

        <QuizCta type="submit" disabled={!isValid} loading={saving} />
      </form>
    </QuizLayout>
  )
}
