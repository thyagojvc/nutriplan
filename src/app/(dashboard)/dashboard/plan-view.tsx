'use client'

import { useState } from 'react'
import type { NutritionPlanJson } from '@/lib/nutrition/types'

const GOAL_LABEL: Record<string, string> = {
  lose_fat: 'Perder grasa',
  gain_muscle: 'Ganar músculo',
  maintain: 'Mantenimiento',
  health_energy: 'Salud y energía',
}

const ACTIVITY_LABEL: Record<string, string> = {
  sedentario: 'Sedentario',
  ligeramente_activo: 'Ligeramente activo',
  moderadamente_activo: 'Moderadamente activo',
  muy_activo: 'Muy activo',
}

const SEX_LABEL: Record<string, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
  male: 'Masculino',
  female: 'Femenino',
}

const DOC_LABEL: Record<string, string> = {
  nutrition_plan: 'Plan nutricional (PDF)',
  training_plan: 'Plan de entrenamiento (PDF)',
}

interface Profile {
  age: number | null
  weightKg: number | null
  heightCm: number | null
  sex: string
  activityLevel: string
}

export function PlanView({
  plan,
  name,
  docKinds = [],
  profile,
}: {
  plan: NutritionPlanJson
  name: string
  docKinds?: string[]
  profile?: Profile
}) {
  const [activeDay, setActiveDay] = useState(0)
  const { summary } = plan
  const day = plan.days[activeDay]

  const imc =
    profile?.weightKg && profile?.heightCm
      ? profile.weightKg / Math.pow(profile.heightCm / 100, 2)
      : null

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 pb-16">

      {/* Header */}
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-bold">Tu plan personalizado</h1>
        <p className="text-sm text-muted-foreground">
          Preparado especialmente para{' '}
          <span className="font-semibold text-primary">{name || 'ti'}</span>
        </p>
      </header>

      {/* Downloads */}
      {docKinds.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {docKinds.filter((k) => DOC_LABEL[k]).map((k) => (
            <a key={k} href={`/api/documents/${k}`}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted">
              ↓ {DOC_LABEL[k]}
            </a>
          ))}
        </div>
      )}

      {/* Cards de perfil */}
      {profile && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Tu perfil</h2>
          <div className="grid grid-cols-3 gap-2">
            <ProfileCard icon="🧑" label="Edad" value={profile.age ? `${profile.age} años` : '—'} />
            <ProfileCard icon="⚖️" label="Peso" value={profile.weightKg ? `${profile.weightKg} kg` : '—'} />
            <ProfileCard icon="📏" label="Altura" value={profile.heightCm ? `${profile.heightCm} cm` : '—'} />
            <ProfileCard icon="🧮" label="IMC" value={imc ? imc.toFixed(1) : '—'} highlight={!!imc} />
            <ProfileCard icon="🎯" label="Objetivo" value={GOAL_LABEL[summary.goal] ?? summary.goal} />
            <ProfileCard icon="⚡" label="Actividad" value={ACTIVITY_LABEL[profile.activityLevel] ?? (profile.activityLevel || '—')} />
          </div>
        </section>
      )}

      {/* Escala de IMC */}
      {imc && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Tu IMC</h2>
            <ImcBadge imc={imc} />
          </div>
          <ImcScale imc={imc} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>&lt;18.5</span>
            <span>18.5–25</span>
            <span>25–30</span>
            <span>&gt;30</span>
          </div>
        </section>
      )}

      {/* Metabolismo */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Tu metabolismo</h2>
        <div className="grid grid-cols-3 gap-3">
          <Metric label="TMB (reposo)" value={`${summary.bmr}`} unit="kcal"
            tooltip="Calorías que tu cuerpo necesita en reposo absoluto" />
          <Metric label="Gasto diario" value={`${summary.tdee}`} unit="kcal"
            tooltip="Lo que quemas con tu nivel de actividad actual" />
          <Metric label="Tu meta" value={`${summary.targetCalories}`} unit="kcal" highlight
            tooltip="Lo que debes consumir para alcanzar tu objetivo" />
        </div>
        <MetabolismExplain goal={summary.goal} tdee={summary.tdee} target={summary.targetCalories} />
      </section>

      {/* Donut de macros */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Distribución de macros</h2>
        <div className="flex items-center gap-6">
          <MacroDonut macros={summary.macros} />
          <div className="space-y-2 flex-1">
            <MacroLegend color="bg-rose-400" label="Proteína"
              value={`${summary.macros.proteinG}g`}
              pct={Math.round((summary.macros.proteinG * 4 / (summary.macros.proteinG * 4 + summary.macros.carbsG * 4 + summary.macros.fatG * 9)) * 100)} />
            <MacroLegend color="bg-amber-400" label="Carbohidratos"
              value={`${summary.macros.carbsG}g`}
              pct={Math.round((summary.macros.carbsG * 4 / (summary.macros.proteinG * 4 + summary.macros.carbsG * 4 + summary.macros.fatG * 9)) * 100)} />
            <MacroLegend color="bg-blue-400" label="Grasas"
              value={`${summary.macros.fatG}g`}
              pct={Math.round((summary.macros.fatG * 9 / (summary.macros.proteinG * 4 + summary.macros.carbsG * 4 + summary.macros.fatG * 9)) * 100)} />
          </div>
        </div>
      </section>

      {/* Notas */}
      {summary.notes.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          {summary.notes.map((n, i) => <li key={i}>• {n}</li>)}
        </ul>
      )}

      {/* Seletor de dias */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tu plan semanal</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {plan.days.map((d, i) => (
            <button key={d.day} onClick={() => setActiveDay(i)}
              className={['shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                i === activeDay ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/70',
              ].join(' ')}>
              {d.label}
            </button>
          ))}
        </div>

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
                {cat.items.map((it, j) => <li key={j}>{it.name}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* Guia */}
      <Section title="Guía de implementación">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          {plan.implementationGuide.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </Section>

      {/* Substituições */}
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

      {/* Disclaimers */}
      {plan.disclaimers.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          {plan.disclaimers.map((d, i) => <p key={i}>{d}</p>)}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function ProfileCard({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={['rounded-lg border p-3 text-center space-y-1', highlight ? 'border-primary/30 bg-primary/5' : ''].join(' ')}>
      <p className="text-xl">{icon}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-bold leading-tight">{value}</p>
    </div>
  )
}

function ImcBadge({ imc }: { imc: number }) {
  const { label, className } =
    imc < 18.5 ? { label: 'Bajo peso', className: 'bg-blue-100 text-blue-700' }
    : imc < 25  ? { label: 'Normal',    className: 'bg-green-100 text-green-700' }
    : imc < 30  ? { label: 'Sobrepeso', className: 'bg-yellow-100 text-yellow-700' }
    :              { label: 'Obesidad',  className: 'bg-red-100 text-red-700' }
  return (
    <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${className}`}>
      {imc.toFixed(1)} — {label}
    </span>
  )
}

function ImcScale({ imc }: { imc: number }) {
  const pct = Math.max(2, Math.min(96, ((imc - 10) / (40 - 10)) * 100))
  return (
    <div className="relative pt-4">
      <div
        className="absolute -top-0 -translate-x-1/2 text-primary text-lg leading-none"
        style={{ left: `${pct}%` }}
      >▼</div>
      <div className="h-3 rounded-full overflow-hidden"
        style={{ background: 'linear-gradient(to right, #60a5fa 0%, #4ade80 30%, #facc15 60%, #f87171 100%)' }} />
    </div>
  )
}

function MacroDonut({ macros }: { macros: { proteinG: number; carbsG: number; fatG: number } }) {
  const r = 45
  const circ = 2 * Math.PI * r
  const pKcal = macros.proteinG * 4
  const cKcal = macros.carbsG * 4
  const fKcal = macros.fatG * 9
  const total = pKcal + cKcal + fKcal || 1
  const pLen = (pKcal / total) * circ
  const cLen = (cKcal / total) * circ
  const fLen = (fKcal / total) * circ

  return (
    <svg className="-rotate-90 shrink-0" width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
      {/* Proteína */}
      <circle cx="55" cy="55" r={r} fill="none" stroke="#fb7185" strokeWidth="12"
        strokeDasharray={`${pLen} ${circ}`} strokeDashoffset={circ} strokeLinecap="butt" />
      {/* Carbos */}
      <circle cx="55" cy="55" r={r} fill="none" stroke="#fbbf24" strokeWidth="12"
        strokeDasharray={`${cLen} ${circ}`} strokeDashoffset={circ - pLen} strokeLinecap="butt" />
      {/* Grasas */}
      <circle cx="55" cy="55" r={r} fill="none" stroke="#60a5fa" strokeWidth="12"
        strokeDasharray={`${fLen} ${circ}`} strokeDashoffset={circ - pLen - cLen} strokeLinecap="butt" />
    </svg>
  )
}

function MacroLegend({ color, label, value, pct }: { color: string; label: string; value: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`h-3 w-3 rounded-full shrink-0 ${color}`} />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-medium">{value}</span>
      <span className="text-xs text-muted-foreground w-8 text-right">({pct}%)</span>
    </div>
  )
}

function Metric({ label, value, unit, highlight, tooltip }: {
  label: string; value: string; unit: string; highlight?: boolean; tooltip?: string
}) {
  return (
    <div title={tooltip}
      className={['rounded-lg border p-3 text-center', highlight ? 'border-primary bg-primary/5' : ''].join(' ')}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">
        {value}<span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  )
}

function MetabolismExplain({ goal, tdee, target }: { goal: string; tdee: number; target: number }) {
  const delta = Math.abs(tdee - target)
  if (goal === 'lose_fat') return (
    <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">
      Para <strong>perder grasa</strong>, tu plan tiene un déficit de{' '}
      <strong>{delta} kcal/día</strong> respecto a lo que tu cuerpo quema.
      Esto equivale a ~{Math.round((delta * 7) / 1000 * 10) / 10} kg menos por semana en condiciones ideales.
    </p>
  )
  if (goal === 'gain_muscle') return (
    <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-900">
      Para <strong>ganar masa muscular</strong>, tu plan tiene un superávit de{' '}
      <strong>{delta} kcal/día</strong> sobre tu gasto diario.
      Suficiente para construir músculo sin acumular grasa en exceso.
    </p>
  )
  return (
    <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      Tu meta calórica está alineada con tu gasto diario para <strong>mantener tu peso</strong> actual.
    </p>
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
