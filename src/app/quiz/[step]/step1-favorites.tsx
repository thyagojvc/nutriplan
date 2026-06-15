'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const FOODS = [
  { id: 'pollo', label: 'Pollo' },
  { id: 'carne_res', label: 'Carne de res' },
  { id: 'cerdo', label: 'Cerdo' },
  { id: 'pescado', label: 'Pescado' },
  { id: 'mariscos', label: 'Mariscos' },
  { id: 'huevo', label: 'Huevo' },
  { id: 'tofu', label: 'Tofu / Tempeh' },
  { id: 'arroz', label: 'Arroz' },
  { id: 'pasta', label: 'Pasta' },
  { id: 'legumbres', label: 'Legumbres' },
  { id: 'frutas', label: 'Frutas' },
  { id: 'verduras', label: 'Verduras' },
  { id: 'lacteos', label: 'Lácteos' },
  { id: 'avena', label: 'Avena' },
  { id: 'aguacate', label: 'Aguacate' },
  { id: 'pan', label: 'Pan / Tortillas' },
]

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step1Favorites({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const cached = sessionStorage.getItem('nutriplan_step_1')
      const parsed = cached ? (JSON.parse(cached) as { favorites?: string[] }) : {}
      return parsed.favorites ?? []
    } catch {
      return []
    }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      sessionStorage.setItem('nutriplan_step_1', JSON.stringify({ favorites: next }))
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
        body: JSON.stringify({ step: 1, answers: { favorites: selected } }),
      })
      if (!res.ok) { setError(true); return }
      router.push('/quiz/2')
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
            <h1 className="text-xl font-semibold">¿Cuáles son tus alimentos favoritos?</h1>
            <p className="text-sm text-muted-foreground">
              Selecciona todos los que quieras incluir en tu plan.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {FOODS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className={[
                  'rounded-lg border-2 px-3 py-2 text-left text-sm transition-colors',
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
