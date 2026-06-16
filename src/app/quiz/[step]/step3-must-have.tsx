'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    } catch {
      return ''
    }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function handleChange(v: string) {
    setValue(v)
    sessionStorage.setItem('nutriplan_step_3', JSON.stringify({ must_have: v }))
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
              <h1 className="text-xl font-semibold">¿Hay algún alimento que no puedas dejar?</h1>
              <p className="text-sm text-muted-foreground">
                Un alimento que pase lo que pase siempre va a estar en tu día.
                Puedes dejarlo en blanco si no tienes ninguno.
              </p>
            </div>

            <input
              type="text"
              placeholder="Ej: café, chocolate, tortillas…"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              maxLength={100}
              autoFocus
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />

            {error && (
              <p className="text-sm text-destructive">Error al guardar. Intenta de nuevo.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Continuar'}
          </button>
        </form>
      </div>
    </main>
  )
}
