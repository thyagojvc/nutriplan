'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizChip, QuizCta, QuizError, QuizSection } from './quiz-ui'

interface FoodItem { id: string; label: string; emoji: string }
interface FoodGroup { title: string; items: FoodItem[] }

// Grupos base (ids batem com o catálogo em food-catalog.ts)
const BASE_GROUPS: FoodGroup[] = [
  {
    title: 'Proteínas',
    items: [
      { id: 'pollo',     label: 'Pollo',         emoji: '🍗' },
      { id: 'carne_res', label: 'Carne de res',  emoji: '🥩' },
      { id: 'cerdo',     label: 'Cerdo',         emoji: '🐷' },
      { id: 'pescado',   label: 'Pescado',       emoji: '🐟' },
      { id: 'mariscos',  label: 'Mariscos',      emoji: '🦐' },
      { id: 'huevo',     label: 'Huevo',         emoji: '🥚' },
      { id: 'tofu',      label: 'Tofu / Tempeh', emoji: '🌿' },
      { id: 'legumbres', label: 'Legumbres',     emoji: '🫘' },
    ],
  },
  {
    title: 'Carbohidratos',
    items: [
      { id: 'arroz', label: 'Arroz', emoji: '🍚' },
      { id: 'pasta', label: 'Pasta', emoji: '🍝' },
      { id: 'pan',   label: 'Pan',   emoji: '🍞' },
      { id: 'avena', label: 'Avena', emoji: '🌾' },
      { id: 'papa',  label: 'Papa',  emoji: '🥔' },
    ],
  },
  {
    title: 'Verduras y frutas',
    items: [
      { id: 'verduras', label: 'Verduras', emoji: '🥦' },
      { id: 'frutas',   label: 'Frutas',   emoji: '🍎' },
    ],
  },
  {
    title: 'Lácteos y grasas',
    items: [
      { id: 'lacteos',  label: 'Lácteos',  emoji: '🥛' },
      { id: 'aguacate', label: 'Aguacate', emoji: '🥑' },
    ],
  },
]

// Alimentos regionais, inseridos no grupo certo conforme o país detectado.
const REGIONAL: Record<string, Record<string, FoodItem[]>> = {
  MX: {
    Carbohidratos: [{ id: 'tortilla_maiz', label: 'Tortilla de maíz', emoji: '🌽' }],
    'Verduras y frutas': [{ id: 'nopales', label: 'Nopales', emoji: '🌵' }],
  },
  CO: {
    Carbohidratos: [
      { id: 'arepa',   label: 'Arepa',   emoji: '🌽' },
      { id: 'platano', label: 'Plátano', emoji: '🍌' },
      { id: 'yuca',    label: 'Yuca',    emoji: '🥔' },
    ],
  },
}

function buildGroups(country?: string): FoodGroup[] {
  const extra = country ? REGIONAL[country] : undefined
  if (!extra) return BASE_GROUPS
  return BASE_GROUPS.map((g) =>
    extra[g.title] ? { ...g, items: [...g.items, ...extra[g.title]] } : g,
  )
}

interface Props {
  stepNumber: number
  totalSteps: number
  detectedCountry?: string
}

export function Step1Dislikes({ stepNumber, totalSteps, detectedCountry }: Props) {
  const router = useRouter()
  const GROUPS = buildGroups(detectedCountry)

  const [selected, setSelected] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const cached = sessionStorage.getItem('nutriplan_step_1')
      const parsed = cached ? (JSON.parse(cached) as { dislikes?: string[] }) : {}
      return parsed.dislikes ?? []
    } catch { return [] }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      sessionStorage.setItem('nutriplan_step_1', JSON.stringify({ dislikes: next }))
      return next
    })
  }

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return // sem mínimo: pode seguir sem marcar nada (come de todo)
    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 1, answers: { dislikes: selected } }),
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
    <QuizLayout showTagline>
      <QuizProgress step={stepNumber} total={totalSteps} pct={progress} />

      <form onSubmit={handleContinue} className="space-y-4">
        <QuizCard>
          <QuizHeader
            title="¿Hay algún alimento que no comes?"
            subtitle="Marca solo los que quieres evitar. Todo lo demás lo incluiremos en tu plan. Si comes de todo, continúa sin marcar nada."
          />

          <div className="space-y-4">
            {GROUPS.map((group) => (
              <QuizSection key={group.title} title={group.title}>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map(({ id, label, emoji }) => (
                    <QuizChip
                      key={id}
                      label={label}
                      emoji={emoji}
                      selected={selected.includes(id)}
                      onToggle={() => toggle(id)}
                    />
                  ))}
                </div>
              </QuizSection>
            ))}
          </div>

          {selected.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Evitaremos {selected.length} alimento{selected.length !== 1 ? 's' : ''} en tu plan
            </p>
          )}

          {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
        </QuizCard>

        <QuizCta type="submit" loading={saving}>
          {selected.length === 0 ? 'Como de todo, continuar' : 'Continuar'}
        </QuizCta>
      </form>
    </QuizLayout>
  )
}
