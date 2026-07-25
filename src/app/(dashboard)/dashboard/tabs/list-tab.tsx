import type { NutritionPlanJson } from '@/lib/nutrition/types'
import { Section } from '../dashboard-ui'

export function ListTab({ plan }: { plan: NutritionPlanJson }) {
  return (
    <div className="space-y-6">
      <Section title="Lista de compras">
        <div className="space-y-3">
          {plan.shoppingList.map((cat, i) => (
            <div key={i}>
              <p className="text-sm font-medium">{cat.category}</p>
              <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                {cat.items.map((it, j) => <li key={j}>{it.name}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Guía de implementación">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          {plan.implementationGuide.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </Section>

      {plan.substitutions.length > 0 && (
        <Section title="Sustituciones">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {plan.substitutions.map((s, i) => (
              <li key={i}>
                <span className="font-medium text-foreground">{s.food}</span> → {s.alternatives.join(', ')}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
