'use client'

import { useState } from 'react'
import type { NutritionPlanJson } from '@/lib/nutrition/types'
import { getFoodImageUrl } from '@/lib/nutrition/food-images'
import { InstallAppBanner } from '../install-app-banner'
import {
  GOAL_LABEL, ACTIVITY_LABEL, WEEKDAYS, WEEK_PHASES, MEAL_EMOJI, MACRO,
  SectionTitle, ProfileCard, ImcBadge, ImcScale, MacroDonut, MacroLegend,
  Metric, MetabolismExplain, type Profile,
} from '../dashboard-ui'

export function PlanTab({
  plan,
  profile,
  nutritionPdfHref,
}: {
  plan: NutritionPlanJson
  profile?: Profile
  nutritionPdfHref?: string
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
    <div className="space-y-6">
      {/* Instalar como app — primeira coisa que se vê ao entrar */}
      <InstallAppBanner />

      {nutritionPdfHref && (
        <a
          href={nutritionPdfHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Descargar plan en PDF
        </a>
      )}

      {/* Cards de perfil */}
      {profile && (
        <section className="space-y-3">
          <SectionTitle>Tu perfil</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <ProfileCard icon="👩" label="Edad" value={profile.age ? `${profile.age} años` : '—'} />
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
            <SectionTitle>Tu IMC</SectionTitle>
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
        <SectionTitle>Tu metabolismo</SectionTitle>
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
        <SectionTitle>Distribución de macros</SectionTitle>
        <div className="flex items-center gap-6">
          <MacroDonut macros={summary.macros} />
          <div className="space-y-2 flex-1">
            <MacroLegend color={MACRO.protein.solid} label="Proteína"
              value={`${summary.macros.proteinG}g`}
              pct={Math.round((summary.macros.proteinG * 4 / (summary.macros.proteinG * 4 + summary.macros.carbsG * 4 + summary.macros.fatG * 9)) * 100)} />
            <MacroLegend color={MACRO.carb.solid} label="Carbohidratos"
              value={`${summary.macros.carbsG}g`}
              pct={Math.round((summary.macros.carbsG * 4 / (summary.macros.proteinG * 4 + summary.macros.carbsG * 4 + summary.macros.fatG * 9)) * 100)} />
            <MacroLegend color={MACRO.fat.solid} label="Grasas"
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
        <SectionTitle>{is4Week ? 'Tu plan de 4 semanas' : 'Tu plan semanal'}</SectionTitle>

        {is4Week ? (
          <div className="space-y-2">
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

        {/* Combo do dia — vem ANTES das refeições de propósito: é o mecanismo
            que ela comprou, e é a única coisa da tela que ela precisa fazer
            diferente hoje. O cardápio é o contexto, o combo é a ação. */}
        {day.combo && (
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">{day.combo.emoji}</span>
              <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
                Combo {day.combo.n} de 7 · hoy
              </span>
            </div>
            <p className="mt-1.5 font-display text-lg font-black text-foreground">
              {day.combo.name}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {day.combo.action}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {day.meals.map((meal, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between bg-primary px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-primary-foreground">
                  {MEAL_EMOJI[meal.name] ?? '🍽️'} {meal.name}
                </span>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white">
                  {meal.totals.kcal} kcal
                </span>
              </div>

              <div className="divide-y divide-border">
                {meal.items.map((item, j) => {
                  const imgUrl = getFoodImageUrl(item.food)
                  return (
                  <div key={j} className="flex items-center gap-3 px-3 py-2.5">
                    {imgUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imgUrl}
                        alt={item.food}
                        className="h-14 w-14 shrink-0 rounded-xl border border-border object-cover shadow-sm"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.food}</p>
                      <p className="text-xs text-muted-foreground">{item.quantity}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: MACRO.protein.chipBg, color: MACRO.protein.chipText }}>{item.proteinG}P</span>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: MACRO.carb.chipBg, color: MACRO.carb.chipText }}>{item.carbsG}C</span>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: MACRO.fat.chipBg, color: MACRO.fat.chipText }}>{item.fatG}G</span>
                    </div>
                  </div>
                  )
                })}
              </div>

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

      {/* Disclaimers */}
      {plan.disclaimers.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          {plan.disclaimers.map((d, i) => <p key={i}>{d}</p>)}
        </div>
      )}
    </div>
  )
}
