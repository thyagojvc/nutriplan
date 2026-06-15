'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const OPTIONS = [
  { id: 'masculino', label: 'Masculino' },
  { id: 'femenino', label: 'Femenino' },
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
    } catch {
      return null
    }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function handleSelect(id: string) {
    setSelected(id)
    sessionStorage.setItem('nutriplan_step_4', JSON.stringify({ sex: id }))
  }

  async function handleContinue() {
    if (!selected || saving) return
    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 4, answers: { sex: selected } }),
      })
      if (!res.ok) { setError(true); return }
      router.push('/quiz/5')
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const progress = Math.round((stepNumber / totalSteps) * 100)

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

        <div className="rounded-lg border p-6 space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">¿Cuál es tu sexo biológico?</h1>
            <p className="text-sm text-muted-foreground">
              Necesitamos este dato para calcular tu metabolismo basal.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSelect(id)}
                className={[
                  'rounded-lg border-2 px-4 py-4 text-center text-sm font-medium transition-colors',
                  selected === id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/50',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {error && (
            <p className="text-sm text-destructive">Error al guardar. Intenta de nuevo.</p>
          )}
        </div>

        <button
          onClick={handleContinue}
          disabled={!selected || saving}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Continuar'}
        </button>
      </div>
    </main>
  )
}
