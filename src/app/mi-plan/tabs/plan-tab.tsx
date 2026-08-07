'use client'

// =============================================================================
// Aba "Mi Plan" — o coração do mecanismo desta página.
//
// O Día 1 vem inteiro, real e usável: as comidas saem dos favoritos que ela
// marcou no quiz e as porções saem do número dela. É o "produto entregue antes
// do pagamento". Não é degustação borrada, ela pode fechar a página e comer
// isso amanhã.
//
// Os outros 6 dias existem, aparecem, e estão trancados. É o contraste entre
// "isto já é meu" e "aquilo está a um toque" que move a compra, não o texto.
// =============================================================================

import type { NutritionPlanJson, PlanDay, PlanMeal } from '@/lib/nutrition/types'
import { getFoodImageUrl } from '@/lib/nutrition/food-images'
import { Lock, Check } from 'lucide-react'
import {
  GOAL_LABEL, ACTIVITY_LABEL, MEAL_EMOJI, MACRO,
  SectionTitle, ProfileCard, ImcBadge, ImcScale, MacroDonut, MacroLegend,
  Metric, MetabolismExplain, type Profile,
} from '@/app/(dashboard)/dashboard/dashboard-ui'
import { LockedBlock } from '../lock-ui'

export function MiPlanTab({
  plan,
  profile,
  onUnlock,
}: {
  plan: NutritionPlanJson
  profile: Profile
  onUnlock: (id: string) => void
}) {
  const { summary } = plan
  const day1 = plan.days[0]
  const day2 = plan.days[1]
  const totalDays = plan.days.length

  const imc =
    profile.weightKg && profile.heightCm
      ? profile.weightKg / Math.pow(profile.heightCm / 100, 2)
      : null

  const macroKcal =
    summary.macros.proteinG * 4 + summary.macros.carbsG * 4 + summary.macros.fatG * 9 || 1
  const pct = (kcal: number) => Math.round((kcal / macroKcal) * 100)

  return (
    <div className="space-y-6">
      {/* Confirmação de posse. É a primeira frase que ela lê dentro do app e
          precisa dizer duas coisas: está pronto, e é dela. */}
      <div className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3.5">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
          Tu plan está listo
        </p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-gray-700">
          Salió de tus respuestas: tus alimentos, tus porciones y tu número de calorías.
          El <strong className="font-bold text-gray-900">Día 1 está abierto</strong>, puedes empezar hoy mismo.
        </p>
      </div>

      {/* Perfil — dados dela, sempre abertos. Travar isto seria travar o que
          ela mesma digitou, e é justamente o que prova que não é plantilla. */}
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

      {imc && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Tu IMC</SectionTitle>
            <ImcBadge imc={imc} />
          </div>
          <ImcScale imc={imc} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>&lt;18.5</span><span>18.5–25</span><span>25–30</span><span>&gt;30</span>
          </div>
        </section>
      )}

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

      <section className="space-y-3">
        <SectionTitle>Distribución de macros</SectionTitle>
        <div className="flex items-center gap-6">
          <MacroDonut macros={summary.macros} />
          <div className="flex-1 space-y-2">
            <MacroLegend color={MACRO.protein.solid} label="Proteína"
              value={`${summary.macros.proteinG}g`} pct={pct(summary.macros.proteinG * 4)} />
            <MacroLegend color={MACRO.carb.solid} label="Carbohidratos"
              value={`${summary.macros.carbsG}g`} pct={pct(summary.macros.carbsG * 4)} />
            <MacroLegend color={MACRO.fat.solid} label="Grasas"
              value={`${summary.macros.fatG}g`} pct={pct(summary.macros.fatG * 9)} />
          </div>
        </div>
      </section>

      {/* Seletor de dias. Os 6 travados ficam VISÍVEIS com cadeado: sumir com
          eles apagaria justamente a informação de que o plano continua. */}
      <section className="space-y-3">
        <SectionTitle>Tus {totalDays} días</SectionTitle>
        <div className="flex gap-1.5">
          <button
            type="button"
            className="flex flex-1 flex-col items-center rounded-xl bg-primary py-2.5 text-primary-foreground shadow-sm"
          >
            <span className="text-[9px] font-medium text-primary-foreground/75">Hoy</span>
            <span className="mt-0.5 text-sm font-bold">D1</span>
          </button>
          {plan.days.slice(1).map((d) => (
            <button
              key={d.day}
              type="button"
              onClick={() => onUnlock(`dia_${d.day}`)}
              className="flex flex-1 flex-col items-center rounded-xl bg-muted py-2.5 text-muted-foreground transition-transform active:scale-95"
            >
              <Lock className="h-2.5 w-2.5" strokeWidth={2.6} />
              <span className="mt-0.5 text-sm font-bold">D{d.day}</span>
            </button>
          ))}
        </div>

        {/* Atajo do dia — aberto. É a prova de que existe método por trás do
            cardápio, e ela pode executar hoje à noite. Os outros 6 ficam na
            aba Bonos, trancados. */}
        {day1.combo && (
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-black text-white">
                {day1.combo.letter}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
                Tu atajo de hoy · 1 de 7
              </span>
            </div>
            <p className="mt-1.5 font-display text-lg font-black text-foreground">
              {day1.combo.emoji} {day1.combo.name}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {day1.combo.action}
            </p>
            {day1.combo.secret && (
              <div className="mt-3 rounded-xl border border-primary/25 bg-white p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-primary">El secreto</p>
                <p className="mt-1 text-[13px] leading-relaxed text-foreground">{day1.combo.secret}</p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          {day1.meals.map((meal, i) => <MealCard key={i} meal={meal} />)}

          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
            <span className="text-sm font-medium text-primary">Total del día</span>
            <span className="text-sm font-semibold">
              {day1.totals.kcal} kcal · {day1.totals.proteinG}g proteína
            </span>
          </div>
        </div>
      </section>

      {/* Día 2 real, borrado. Não é um placeholder: é o dia que ela recebe.
          Ver o formato completo por trás do desfoque é o que faz o cadeado
          significar "tem algo ali" em vez de "talvez tenha algo ali". */}
      {day2 && (
        <section className="space-y-3">
          <SectionTitle>Mañana te toca</SectionTitle>
          <LockedBlock
            id="dia_2_preview"
            title={`Tu Día 2 ya está armado, y los otros ${totalDays - 2} también`}
            hint="Comidas distintas, mismos alimentos tuyos, mismo número de calorías."
            onUnlock={onUnlock}
          >
            <div className="space-y-3 p-1">
              {day2.meals.slice(0, 2).map((meal, i) => <MealCard key={i} meal={meal} />)}
            </div>
          </LockedBlock>
        </section>
      )}

      {plan.disclaimers.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          {plan.disclaimers.map((d, i) => <p key={i}>{d}</p>)}
        </div>
      )}
    </div>
  )
}

/** Uma refeição completa, no mesmo formato que ela vai ver no app depois. */
function MealCard({ meal }: { meal: PlanMeal }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
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
  )
}

export type { PlanDay }
