'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const OPTIONS = [
  { id: 'ninguna', label: 'Ninguna restricción', exclusive: true },
  { id: 'vegetariano', label: 'Vegetariano' },
  { id: 'vegano', label: 'Vegano' },
  { id: 'sin_gluten', label: 'Sin gluten' },
  { id: 'sin_lactosa', label: 'Sin lactosa' },
  { id: 'sin_mariscos', label: 'Sin mariscos' },
  { id: 'sin_cerdo', label: 'Sin cerdo' },
  { id: 'otra', label: 'Otra' },
]

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step8Restrictions({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const cached = sessionStorage.getItem('nutriplan_step_8')
      const parsed = cached ? (JSON.parse(cached) as { restrictions?: string[] }) : {}
      return parsed.restrictions ?? []
    } catch {
      return []
    }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      let next: string[]
      if (id === 'ninguna') {
        next = prev.includes('ninguna') ? [] : ['ninguna']
      } else {
        const without = prev.filter((x) => x !== 'ninguna')
        next = without.includes(id) ? without.filter((x) => x !== id) : [...without, id]
      }
      sessionStorage.setItem('nutriplan_step_8', JSON.stringify({ restrictions: next }))
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
        body: JSON.stringify({ step: 8, answers: { restrictions: selected } }),
      })
      if (!res.ok) { setError(true); return }
      router.push('/quiz/9')
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
            <h1 className="text-xl font-semibold">¿Tienes restricciones alimentarias?</h1>
            <p className="text-sm text-muted-foreground">Selecciona todas las que apliquen.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className={[
                  'rounded-lg border-2 px-3 py-2 text-left text-sm transition-colors',
                  id === 'ninguna' ? 'col-span-2' : '',
                  selected.includes(id)
                    ? 'border-primary bg-primary/5 font-medium'
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
          disabled={selected.length === 0 || saving}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Continuar'}
        </button>
      </div>
    </main>
  )
}
