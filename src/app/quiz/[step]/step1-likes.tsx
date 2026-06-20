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
      { id: 'atun',      label: 'Atún',          emoji: '🥫' },
      { id: 'mariscos',  label: 'Mariscos',      emoji: '🦐' },
      { id: 'pavo',      label: 'Pavo',          emoji: '🦃' },
      { id: 'huevo',     label: 'Huevo',         emoji: '🥚' },
      { id: 'tofu',      label: 'Tofu / Tempeh', emoji: '🌿' },
      { id: 'legumbres', label: 'Legumbres',     emoji: '🥜' },
    ],
  },
  {
    title: 'Carbohidratos',
    items: [
      { id: 'arroz',   label: 'Arroz',          emoji: '🍚' },
      { id: 'pasta',   label: 'Pasta',          emoji: '🍝' },
      { id: 'pan',     label: 'Pan',            emoji: '🍞' },
      { id: 'avena',   label: 'Avena',          emoji: '🌾' },
      { id: 'granola', label: 'Granola',        emoji: '🥣' },
      { id: 'papa',    label: 'Papa',           emoji: '🥔' },
      { id: 'camote',  label: 'Camote',         emoji: '🍠' },
      { id: 'quinoa',  label: 'Quinoa',         emoji: '🍲' },
    ],
  },
  {
    title: 'Verduras',
    items: [
      { id: 'verduras',    label: 'Verduras variadas', emoji: '🥗' },
      { id: 'brocoli',     label: 'Brócoli',           emoji: '🥦' },
      { id: 'zanahoria',   label: 'Zanahoria',         emoji: '🥕' },
      { id: 'calabacin',   label: 'Calabacín',         emoji: '🥒' },
      { id: 'ejotes',      label: 'Ejotes',            emoji: '🌱' },
      { id: 'champinones', label: 'Champiñones',       emoji: '🍄' },
      { id: 'pimiento',    label: 'Pimiento',          emoji: '🌶️' },
      { id: 'espinaca',    label: 'Espinaca',          emoji: '🥬' },
      { id: 'tomate',      label: 'Tomate',            emoji: '🍅' },
      { id: 'coliflor',    label: 'Coliflor',          emoji: '🌿' },
      { id: 'pepino',      label: 'Pepino',            emoji: '🥒' },
    ],
  },
  {
    title: 'Frutas',
    items: [
      { id: 'frutas',  label: 'Frutas variadas', emoji: '🍎' },
      { id: 'manzana', label: 'Manzana',         emoji: '🍎' },
      { id: 'banana',  label: 'Plátano',         emoji: '🍌' },
      { id: 'fresa',   label: 'Fresas',          emoji: '🍓' },
      { id: 'papaya',  label: 'Papaya',          emoji: '🧡' },
      { id: 'pina',    label: 'Piña',            emoji: '🍍' },
      { id: 'mango',   label: 'Mango',           emoji: '🥭' },
      { id: 'naranja', label: 'Naranja',         emoji: '🍊' },
    ],
  },
  {
    title: 'Lácteos y grasas',
    items: [
      { id: 'lacteos',      label: 'Leche',         emoji: '🥛' },
      { id: 'yogur_griego', label: 'Yogur griego',  emoji: '🥣' },
      { id: 'queso_fresco', label: 'Queso fresco',  emoji: '🧀' },
      { id: 'aguacate',     label: 'Aguacate',      emoji: '🥑' },
      { id: 'nueces',       label: 'Nueces',        emoji: '🌰' },
    ],
  },
]

// Alimentos regionais, inseridos no grupo certo conforme o país detectado.
const REGIONAL: Record<string, Record<string, FoodItem[]>> = {
  MX: {
    Carbohidratos: [{ id: 'tortilla_maiz', label: 'Tortilla de maíz', emoji: '🌽' }],
    Verduras: [{ id: 'nopales', label: 'Nopales', emoji: '🌵' }],
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

export function Step1Likes({ stepNumber, totalSteps, detectedCountry }: Props) {
  const router = useRouter()
  const GROUPS = buildGroups(detectedCountry)

  const [selected, setSelected] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const cached = sessionStorage.getItem('nutriplan_step_1')
      const parsed = cached ? (JSON.parse(cached) as { likes?: string[] }) : {}
      return parsed.likes ?? []
    } catch { return [] }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      sessionStorage.setItem('nutriplan_step_1', JSON.stringify({ likes: next }))
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
        body: JSON.stringify({ step: 1, answers: { likes: selected } }),
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
            title={
              <>
                ¿Qué alimentos te <span className="text-primary">gusta</span> comer?
              </>
            }
            subtitle="Marca tus favoritos y armaremos tu plan con ellos. Si comes de todo, continúa sin marcar nada."
          />

          <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/8 px-3.5 py-2.5 text-xs font-medium text-primary">
            <span className="text-sm">✅</span>
            Los alimentos que marques tendrán prioridad en tu plan.
          </div>

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
              Incluiremos {selected.length} alimento{selected.length !== 1 ? 's' : ''} que te gusta{selected.length !== 1 ? 'n' : ''} en tu plan
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
