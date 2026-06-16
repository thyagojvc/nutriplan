'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    } catch {
      return { age: '', weight_kg: '', height_cm: '' }
    }
  })

  const [ageBlocked, setAgeBlocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

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
      router.push('/quiz/6')
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const progress = Math.round((stepNumber / totalSteps) * 100)

  if (ageBlocked) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg text-center space-y-6">
          <div className="rounded-lg border p-8 space-y-4">
            <p className="text-5xl">🚫</p>
            <h1 className="text-xl font-semibold">Lo sentimos</h1>
            <p className="text-sm text-muted-foreground">
              NutriPlan es exclusivo para personas mayores de 18 años.
              No podemos continuar con tu solicitud.
            </p>
          </div>
        </div>
      </main>
    )
  }

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

        <form onSubmit={handleContinue} className="space-y-6">
          <div className="rounded-lg border p-6 space-y-5">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">Tus datos físicos</h1>
              <p className="text-sm text-muted-foreground">
                Los usaremos para calcular tus calorías y macros exactos.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium">Edad (años)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  placeholder="Ej: 28"
                  value={data.age}
                  onChange={(e) => handleChange('age', e.target.value)}
                  autoFocus
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {data.age !== '' && !isNaN(parseInt(data.age)) && parseInt(data.age) < 18 && (
                  <p className="text-xs text-destructive">Debes tener al menos 18 años.</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium">Peso (kg)</label>
                <input
                  type="number"
                  min={40}
                  max={250}
                  step={0.1}
                  placeholder="Ej: 70"
                  value={data.weight_kg}
                  onChange={(e) => handleChange('weight_kg', e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium">Altura (cm)</label>
                <input
                  type="number"
                  min={130}
                  max={220}
                  placeholder="Ej: 170"
                  value={data.height_cm}
                  onChange={(e) => handleChange('height_cm', e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">Error al guardar. Intenta de nuevo.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!isValid || saving}
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Continuar'}
          </button>
        </form>
      </div>
    </main>
  )
}
