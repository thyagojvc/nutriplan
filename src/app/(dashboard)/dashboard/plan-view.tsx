'use client'

import { useState } from 'react'
import type { NutritionPlanJson } from '@/lib/nutrition/types'
import { getFoodImageUrl } from '@/lib/nutrition/food-images'

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
  anti_celulitis: 'Guía anti-celulitis (PDF)',
  recipes: '28 recetas fitness (PDF)',
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const WEEK_PHASES = [
  { label: 'Adaptación',    color: 'text-emerald-600' },
  { label: 'Calibración',   color: 'text-emerald-600' },
  { label: 'Aceleración',   color: 'text-amber-500'   },
  { label: 'Consolidación', color: 'text-rose-500'    },
]

const MEAL_EMOJI: Record<string, string> = {
  Desayuno: '☀️',
  Almuerzo: '🍽️',
  Cena: '🌙',
  Snack: '🍎',
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
  devPdfHref,
  docUrls,
  profile,
}: {
  plan: NutritionPlanJson
  name: string
  docKinds?: string[]
  devPdfHref?: string
  docUrls?: Record<string, string>
  profile?: Profile
}) {
  const [activeDay, setActiveDay] = useState(0)
  const [activeWeek, setActiveWeek] = useState(0)
  const { summary } = plan
  const is4Week = plan.summary.cycleDays > 7
  const day = plan.days[is4Week ? activeWeek * 7 + activeDay : activeDay]

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
        <div className="space-y-2">
          <p className="text-center text-xs text-muted-foreground">
            Descarga tu plan para verlo sin internet
          </p>
          <div className="flex flex-col gap-2">
            {docKinds.filter((k) => DOC_LABEL[k]).map((k) => (
              <a
                key={k}
                href={docUrls?.[k] ?? devPdfHref ?? `/api/documents/${k}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {DOC_LABEL[k]}
              </a>
            ))}
          </div>
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
        <h2 className="text-lg font-semibold">
          {is4Week ? 'Tu plan de 4 semanas' : 'Tu plan semanal'}
        </h2>

        {is4Week ? (
          <div className="space-y-2">
            {/* Abas de semana */}
            <div className="grid grid-cols-4 gap-1.5">
              {WEEK_PHASES.map((phase, w) => (
                <button key={w}
                  onClick={() => { setActiveWeek(w); setActiveDay(0) }}
                  className={[
                    'flex flex-col items-center rounded-xl py-2.5 px-1 transition-all',
                    w === activeWeek
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted hover:bg-muted/70',
                  ].join(' ')}>
                  <span className="text-sm font-bold">Sem {w + 1}</span>
                  <span className={[
                    'text-[9px] font-medium mt-0.5 leading-tight text-center',
                    w === activeWeek ? 'text-primary-foreground/75' : phase.color,
                  ].join(' ')}>
                    {phase.label}
                  </span>
                </button>
              ))}
            </div>
            {/* Pills de dia */}
            <div className="flex gap-1">
              {Array.from({ length: 7 }, (_, i) => (
                <button key={i}
                  onClick={() => setActiveDay(i)}
                  className={[
                    'flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors',
                    i === activeDay
                      ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
                      : 'bg-muted hover:bg-muted/70 text-muted-foreground',
                  ].join(' ')}>
                  D{i + 1}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {plan.days.map((d, i) => (
              <button key={d.day} onClick={() => setActiveDay(i)}
                className={[
                  'flex flex-col items-center rounded-xl py-2.5 transition-all',
                  i === activeDay
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted hover:bg-muted/70',
                ].join(' ')}>
                <span className={[
                  'text-[9px] font-medium',
                  i === activeDay ? 'text-primary-foreground/70' : 'text-muted-foreground',
                ].join(' ')}>{WEEKDAYS[i]}</span>
                <span className="text-sm font-bold mt-0.5">{i + 1}</span>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {day.meals.map((meal, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border">
              {/* Header verde com emoji e kcal */}
              <div className="flex items-center justify-between bg-primary px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-primary-foreground">
                  {MEAL_EMOJI[meal.name] ?? '🍽️'} {meal.name}
                </span>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white">
                  {meal.totals.kcal} kcal
                </span>
              </div>

              {/* Itens */}
              <div className="divide-y divide-border">
                {meal.items.map((item, j) => {
                  const imgUrl = getFoodImageUrl(item.food)
                  return (
                  <div key={j} className="flex items-center gap-3 px-3 py-2">
                    {imgUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imgUrl}
                        alt={item.food}
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.food}</p>
                      <p className="text-xs text-muted-foreground">{item.quantity}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-700">{item.proteinG}P</span>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700">{item.carbsG}C</span>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700">{item.fatG}G</span>
                    </div>
                  </div>
                  )
                })}
              </div>

              {/* Rodapé com macros totais da refeição */}
              <div className="bg-muted/40 px-4 py-1.5 text-right text-[11px] text-muted-foreground">
                {meal.totals.proteinG}g prot · {meal.totals.carbsG}g carb · {meal.totals.fatG}g gras
              </div>
            </div>
          ))}

          <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-2.5 flex justify-between items-center">
            <span className="text-sm font-medium text-primary">Total del día</span>
            <span className="text-sm font-semibold">{day.totals.kcal} kcal · {day.totals.proteinG}g proteína</span>
          </div>
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
      Esto equivale a ~{Math.round((delta * 7) / 7700 * 10) / 10} kg menos por semana en condiciones ideales.
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
