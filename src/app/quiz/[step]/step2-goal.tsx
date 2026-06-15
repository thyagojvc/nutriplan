'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const GOALS = [
  {
    id: 'perder_peso',
    label: 'Perder peso',
    desc: 'Quiero reducir mi grasa corporal',
  },
  {
    id: 'mantener',
    label: 'Mantener mi peso',
    desc: 'Quiero mantenerme saludable sin cambiar mi peso',
  },
  {
    id: 'ganar_masa',
    label: 'Ganar masa muscular',
    desc: 'Quiero aumentar mi masa muscular',
  },
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
    } catch {
      return null
    }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function handleSelect(id: string) {
    setSelected(id)
    sessionStorage.setItem('nutriplan_step_2', JSON.stringify({ goal: id }))
  }

  async function handleContinue() {
    if (!selected || saving) return
    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 2, answers: { goal: selected } }),
      })
      if (!res.ok) { setError(true); return }
      router.push('/quiz/3')
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
          <h1 className="text-xl font-semibold">¿Cuál es tu objetivo principal?</h1>

          <div className="space-y-3">
            {GOALS.map(({ id, label, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSelect(id)}
                className={[
                  'w-full rounded-lg border-2 px-4 py-3 text-left transition-colors',
                  selected === id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                ].join(' ')}
              >
                <p className={['text-sm font-medium', selected === id ? 'text-primary' : ''].join(' ')}>
                  {label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
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
