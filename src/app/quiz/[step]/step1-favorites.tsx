'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizChip, QuizCta, QuizError } from './quiz-ui'

const GENERIC_FOODS = [
  { id: 'pollo',       label: 'Pollo',         emoji: '🍗' },
  { id: 'carne_res',   label: 'Carne de res',  emoji: '🥩' },
  { id: 'cerdo',       label: 'Cerdo',         emoji: '🐷' },
  { id: 'pescado',     label: 'Pescado',        emoji: '🐟' },
  { id: 'mariscos',    label: 'Mariscos',      emoji: '🦐' },
  { id: 'huevo',       label: 'Huevo',         emoji: '🥚' },
  { id: 'tofu',        label: 'Tofu / Tempeh', emoji: '🌿' },
  { id: 'arroz',       label: 'Arroz',         emoji: '🍚' },
  { id: 'pasta',       label: 'Pasta',         emoji: '🍝' },
  { id: 'legumbres',   label: 'Legumbres',     emoji: '🫘' },
  { id: 'frutas',      label: 'Frutas',        emoji: '🍎' },
  { id: 'verduras',    label: 'Verduras',      emoji: '🥦' },
  { id: 'lacteos',     label: 'Lácteos',       emoji: '🥛' },
  { id: 'avena',       label: 'Avena',         emoji: '🌾' },
  { id: 'aguacate',    label: 'Aguacate',      emoji: '🥑' },
  { id: 'pan',         label: 'Pan',           emoji: '🍞' },
]

const FOODS_BY_COUNTRY: Record<string, typeof GENERIC_FOODS> = {
  MX: [
    { id: 'tortilla_maiz', label: 'Tortilla de maíz', emoji: '🫓' },
    { id: 'nopales',       label: 'Nopales',           emoji: '🌵' },
    ...GENERIC_FOODS,
  ],
  CO: [
    { id: 'arepa',   label: 'Arepa',   emoji: '🫔' },
    { id: 'platano', label: 'Plátano', emoji: '🍌' },
    { id: 'yuca',    label: 'Yuca',    emoji: '🥔' },
    ...GENERIC_FOODS,
  ],
}

function getFoodsForCountry(country?: string) {
  if (country && FOODS_BY_COUNTRY[country]) return FOODS_BY_COUNTRY[country]
  return GENERIC_FOODS
}

interface Props {
  stepNumber: number
  totalSteps: number
  detectedCountry?: string
}

export function Step1Favorites({ stepNumber, totalSteps, detectedCountry }: Props) {
  const router = useRouter()
  const FOODS = getFoodsForCountry(detectedCountry)

  const [selected, setSelected] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const cached = sessionStorage.getItem('nutriplan_step_1')
      const parsed = cached ? (JSON.parse(cached) as { favorites?: string[] }) : {}
      return parsed.favorites ?? []
    } catch { return [] }
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

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault()
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
    <QuizLayout>
      <QuizProgress step={stepNumber} total={totalSteps} pct={progress} />

      <form onSubmit={handleContinue} className="space-y-4">
        <QuizCard>
          <QuizHeader
            title="¿Cuáles son tus alimentos favoritos?"
            subtitle="Selecciona todos los que quieras incluir en tu plan. Cuantos más elijas, más variado será."
          />

          <div className="grid grid-cols-2 gap-2">
            {FOODS.map(({ id, label, emoji }) => (
              <QuizChip
                key={id}
                label={label}
                emoji={emoji}
                selected={selected.includes(id)}
                onToggle={() => toggle(id)}
              />
            ))}
          </div>

          {selected.length > 0 && (
            <p className="text-center text-xs text-primary font-medium">
              {selected.length} seleccionado{selected.length !== 1 ? 's' : ''} ✓
            </p>
          )}

          {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
        </QuizCard>

        <QuizCta type="submit" disabled={selected.length === 0} loading={saving} />
      </form>
    </QuizLayout>
  )
}
