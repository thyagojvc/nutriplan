'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const OPTIONS = [
  { id: 'falta_tiempo', label: 'Falta de tiempo', desc: 'Mi agenda está siempre llena' },
  { id: 'falta_motivacion', label: 'Falta de motivación', desc: 'Me cuesta mantener la constancia' },
  { id: 'no_se_que_comer', label: 'No sé qué comer', desc: 'Me pierdo entre tanta información' },
  { id: 'comer_fuera', label: 'Comer fuera de casa', desc: 'Trabajo o viajo mucho' },
  { id: 'presupuesto', label: 'Presupuesto limitado', desc: 'Quiero comer bien sin gastar mucho' },
  { id: 'antojos', label: 'Antojos y tentaciones', desc: 'Me cuesta resistir ciertos alimentos' },
]

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step11Obstacle({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const cached = sessionStorage.getItem('nutriplan_step_11')
      const parsed = cached ? (JSON.parse(cached) as { obstacles?: string[] }) : {}
      return parsed.obstacles ?? []
    } catch {
      return []
    }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      sessionStorage.setItem('nutriplan_step_11', JSON.stringify({ obstacles: next }))
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
        body: JSON.stringify({ step: 11, answers: { obstacles: selected } }),
      })
      if (!res.ok) { setError(true); return }
      router.push('/quiz/12')
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
            <h1 className="text-xl font-semibold">
              ¿Cuáles son tus mayores obstáculos para mejorar tu alimentación?
            </h1>
            <p className="text-sm text-muted-foreground">Selecciona todos los que apliquen.</p>
          </div>

          <div className="space-y-2">
            {OPTIONS.map(({ id, label, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className={[
                  'w-full rounded-lg border-2 px-4 py-3 text-left transition-colors',
                  selected.includes(id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50',
                ].join(' ')}
              >
                <p className={['text-sm font-medium', selected.includes(id) ? 'text-primary' : ''].join(' ')}>
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
          disabled={selected.length === 0 || saving}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Continuar'}
        </button>
      </div>
    </main>
  )
}
