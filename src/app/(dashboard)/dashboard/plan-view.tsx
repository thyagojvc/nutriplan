'use client'

import { useState } from 'react'
import type { NutritionPlanJson } from '@/lib/nutrition/types'

const GOAL_LABEL: Record<string, string> = {
  lose_fat: 'Perder grasa',
  gain_muscle: 'Ganar masa muscular',
  maintain: 'Mantenimiento',
  health_energy: 'Salud y energía',
}

const DOC_LABEL: Record<string, string> = {
  nutrition_plan: 'Plan nutricional (PDF)',
  training_plan: 'Plan de entrenamiento (PDF)',
}

export function PlanView({
  plan,
  name,
  docKinds = [],
}: {
  plan: NutritionPlanJson
  name: string
  docKinds?: string[]
}) {
  const [activeDay, setActiveDay] = useState(0)
  const { summary } = plan
  const day = plan.days[activeDay]

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 pb-16">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Tu plan nutricional</h1>
        <p className="text-sm text-muted-foreground">
          {name ? `${name}, este` : 'Este'} es tu plan personalizado ·{' '}
          {GOAL_LABEL[summary.goal] ?? summary.goal}
        </p>
      </header>

      {docKinds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {docKinds
            .filter((k) => DOC_LABEL[k])
            .map((k) => (
              <a
                key={k}
                href={`/api/documents/${k}`}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                ↓ {DOC_LABEL[k]}
              </a>
            ))}
        </div>
      )}

      {/* Resumo de metas */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Calorías/día" value={`${summary.targetCalories}`} unit="kcal" highlight />
        <Metric label="Proteína" value={`${summary.macros.proteinG}`} unit="g" />
        <Metric label="Carbohidratos" value={`${summary.macros.carbsG}`} unit="g" />
        <Metric label="Grasas" value={`${summary.macros.fatG}`} unit="g" />
      </section>

      {summary.notes.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          {summary.notes.map((n, i) => (
            <li key={i}>• {n}</li>
          ))}
        </ul>
      )}

      {/* Seletor de dias */}
      <section className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {plan.days.map((d, i) => (
            <button
              key={d.day}
              onClick={() => setActiveDay(i)}
              className={[
                'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                i === activeDay
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/70',
              ].join(' ')}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Refeições do dia ativo */}
        <div className="space-y-3">
          {day.meals.map((meal, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{meal.name}</h3>
                <span className="text-xs text-muted-foreground">{meal.totals.kcal} kcal</span>
              </div>
              <ul className="space-y-1.5">
                {meal.items.map((item, j) => (
                  <li key={j} className="flex items-baseline justify-between gap-3 text-sm">
                    <span>
                      <span className="font-medium">{item.food}</span>
                      <span className="text-muted-foreground"> · {item.quantity}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.proteinG}P · {item.carbsG}C · {item.fatG}G
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-right text-xs text-muted-foreground">
            Total del día: {day.totals.kcal} kcal · {day.totals.proteinG}g proteína
          </p>
        </div>
      </section>

      {/* Lista de compras */}
      <Section title="Lista de compras">
        <div className="space-y-3">
          {plan.shoppingList.map((cat, i) => (
            <div key={i}>
              <p className="text-sm font-medium">{cat.category}</p>
              <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                {cat.items.map((it, j) => (
                  <li key={j}>{it.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* Guia de implementação */}
      <Section title="Guía de implementación">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          {plan.implementationGuide.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </Section>

      {/* Substituições */}
      {plan.substitutions.length > 0 && (
        <Section title="Sustituciones">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {plan.substitutions.map((s, i) => (
              <li key={i}>
                <span className="font-medium text-foreground">{s.food}</span> →{' '}
                {s.alternatives.join(', ')}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Disclaimers */}
      {plan.disclaimers.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          {plan.disclaimers.map((d, i) => (
            <p key={i}>{d}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  unit,
  highlight,
}: {
  label: string
  value: string
  unit: string
  highlight?: boolean
}) {
  return (
    <div
      className={[
        'rounded-lg border p-3 text-center',
        highlight ? 'border-primary bg-primary/5' : '',
      ].join(' ')}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">
        {value}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}
