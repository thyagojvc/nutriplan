'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, Gauge, Flame, PieChart, Cake, Scale, Ruler, Target, Zap,
  Sunrise, Utensils, Moon, Apple, ShoppingCart, ShieldCheck, Clock, Coffee, Check, Lock, RotateCcw,
} from 'lucide-react'
import Image from 'next/image'
import { NutriWordmark } from '@/app/quiz/[step]/quiz-ui'
import { parseAnswers } from '@/lib/nutrition/answers'
import { calcTargets } from '@/lib/nutrition/math'
import { buildPreviewSample, type SampleMeal, type PreviewSample } from '@/lib/nutrition/generate'
import { trackPixelOnce } from '@/lib/fb-pixel'

const GOAL_LABEL: Record<string, string> = {
  lose_fat: 'Perder grasa',
  gain_muscle: 'Ganar músculo',
  maintain: 'Mantenimiento',
  health_energy: 'Salud y energía',
  perder_peso: 'Perder peso',
  mantener: 'Mantener peso',
  ganar_masa: 'Ganar músculo',
}

const ACTIVITY_LABEL: Record<string, string> = {
  sedentario: 'Sedentario',
  ligeramente_activo: 'Liger. activo',
  moderadamente_activo: 'Mod. activo',
  muy_activo: 'Muy activo',
}

// Resultados reales de pacientes (fotos con consentimiento por escrito).
// Nombres hispanos para generar identificación en los mercados meta (MX/CO/CL/ES).
const RESULTS = [
  { photo: '/resultados/caso-1.png', name: 'Camila',   country: '🇲🇽', age: 38, result: '−17 kg en 5 meses', w: 414, h: 444 },
  { photo: '/resultados/caso-2.png', name: 'Daniela',  country: '🇨🇴', age: 31, result: '−6 kg en 2 meses',  w: 410, h: 433 },
  { photo: '/resultados/caso-3.png', name: 'Fernanda', country: '🇨🇱', age: 29, result: '−7 kg en 3 meses',  w: 402, h: 430 },
  { photo: '/resultados/caso-4.png', name: 'Carolina', country: '🇪🇸', age: 42, result: '−10 kg en 4 meses', w: 407, h: 436 },
]

interface PreviewData {
  profile: {
    age: number | null
    weightKg: number | null
    heightCm: number | null
    sex: string
    activityLevel: string
  }
  targets: {
    bmr: number
    tdee: number
    targetCalories: number
    goal: string
    macros: { proteinG: number; carbsG: number; fatG: number }
  }
  sample?: PreviewSample
}

// Emoji por refeição — só visual; as refeições reais vêm de buildPreviewSample.
const MEAL_EMOJI: Record<string, string> = {
  Desayuno: '☀️', Almuerzo: '🍽️', Cena: '🌙', Snack: '🍎',
}

// Uma refeição do teaser — amostra real do Día 1, montada com as likes do usuário.
function TeaserMeal({ meal }: { meal: SampleMeal }) {
  const totals = meal.items.reduce(
    (t, it) => ({ p: t.p + it.proteinG, c: t.c + it.carbsG, f: t.f + it.fatG }),
    { p: 0, c: 0, f: 0 },
  )
  return (
    <div className="overflow-hidden rounded-xl border border-[#D8E8D4] shadow-sm">
      <div className="flex items-center justify-between bg-primary px-3.5 py-2.5">
        <span className="text-sm font-semibold text-white">{MEAL_EMOJI[meal.name] ?? '🍴'} {meal.name}</span>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white">{meal.kcal} kcal</span>
      </div>
      <div className="divide-y divide-[#EAF2E6]">
        {meal.items.map((it) => (
          <div key={it.food} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">{it.food}</p>
              <p className="text-[11px] text-muted-foreground">{it.qty}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-700">{it.proteinG}P</span>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700">{it.carbsG}C</span>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700">{it.fatG}G</span>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-[#F5FAF2] px-3.5 py-1.5 text-right text-[10px] text-muted-foreground">
        {totals.p}g prot · {totals.c}g carb · {totals.f}g gras
      </div>
    </div>
  )
}

type ErrorKind = 'no_session' | 'calc_failed' | 'network'

export default function PreviewPage() {
  const router = useRouter()
  const [data, setData] = useState<PreviewData | null>(null)
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null)
  const [leadInfo, setLeadInfo] = useState<{ email?: string; name?: string }>({})
  const [ctaState, setCtaState] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    try {
      const step12 = sessionStorage.getItem('nutriplan_step_12')
      if (step12) {
        const lead = JSON.parse(step12) as Record<string, string>
        setLeadInfo({ email: lead.email, name: lead.name })
      }
    } catch {}
  }, [])

  // Visualização da oferta: dispara quando a preview carrega com dados reais.
  useEffect(() => {
    if (data) trackPixelOnce('px_view_preview', 'ViewContent', { content_name: 'preview_plan' })
  }, [data])

  const HOTMART_URLS: Record<string, string> = {
    '4weeks':  'https://pay.hotmart.com/V106475995N',
    'standard': 'https://pay.hotmart.com/O106407229L',
  }

  async function handleCta(type: '4weeks' | 'standard') {
    if (ctaState === 'loading') return
    setCtaState('loading')
    try {
      const r = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ include_bump: false, plan_type: type }),
      })
      const d = await r.json()
      if (!d.order_id) { setCtaState('error'); return }

      document.cookie = `nutriplan_order_id=${d.order_id}; path=/; max-age=3600; SameSite=Lax`
      if (d.idempotency_key) {
        document.cookie = `nutriplan_order_key=${d.idempotency_key}; path=/; max-age=3600; SameSite=Lax`
        sessionStorage.setItem('nutriplan_idempotency_key', d.idempotency_key)
      }

      if (process.env.NODE_ENV !== 'production') {
        await fetch('/api/dev/simulate-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: d.order_id }),
        })
        router.push(`/exito?order=${d.order_id}`)
        return
      }

      const base = HOTMART_URLS[type]
      const params = new URLSearchParams()
      if (leadInfo.email) params.set('email', leadInfo.email)
      if (leadInfo.name)  params.set('name',  leadInfo.name)
      window.location.href = `${base}?${params.toString()}`
    } catch {
      setCtaState('error')
    }
  }

  useEffect(() => {
    // Lê o draft do sessionStorage (preenchido passo a passo durante o quiz).
    function readSession(): { draft: Record<string, unknown>; country: string; activityLevel: string } | null {
      try {
        const draft: Record<string, unknown> = {}
        for (let n = 1; n <= 10; n++) {
          const raw = sessionStorage.getItem(`nutriplan_step_${n}`)
          if (raw) draft[`step_${n}`] = JSON.parse(raw)
        }

        const s5 = (draft.step_5 ?? {}) as Record<string, unknown>
        const s6 = (draft.step_6 ?? {}) as Record<string, unknown>
        // Sem dados físicos não dá para calcular.
        if (!s5.age || !s5.weight_kg || !s5.height_cm) return null

        // Garante activity_factor mesmo que o step 6 tenha sido salvo numa versão
        // mais antiga sem esse campo (deriva do activity_level se ausente).
        if (!s6.activity_factor && s6.activity_level) {
          const FACTORS: Record<string, number> = {
            sedentario: 1.2, ligeramente_activo: 1.375,
            moderadamente_activo: 1.55, muy_activo: 1.725,
          }
          const f = FACTORS[String(s6.activity_level)]
          if (f) draft.step_6 = { ...s6, activity_factor: f }
        }

        let country = 'OTHER'
        const activityLevel = String(s6.activity_level ?? '')
        const step7Raw = sessionStorage.getItem('nutriplan_step_7')
        if (step7Raw) {
          const s7 = JSON.parse(step7Raw) as { country?: string }
          if (s7.country) country = s7.country
        }
        return { draft, country, activityLevel }
      } catch {
        return null
      }
    }

    // ── Caminho 1: cálculo direto no browser (sem rede, sem cookie) ──────────
    const session = readSession()
    if (session) {
      try {
        const answers = parseAnswers(session.draft, session.country)
        const targets = calcTargets(answers)
        setData({
          profile: {
            age: answers.age,
            weightKg: answers.weightKg,
            heightCm: answers.heightCm,
            sex: answers.sex,
            activityLevel: session.activityLevel,
          },
          targets: {
            bmr: targets.bmr,
            tdee: targets.tdee,
            targetCalories: targets.targetCalories,
            goal: targets.goal,
            macros: targets.macros,
          },
          sample: buildPreviewSample(answers, targets),
        })
        return
      } catch {
        // Se parseAnswers lançar (dados inválidos), cai no fallback de API.
      }
    }

    // ── Caminho 2: fallback via API (aba nova, sessionStorage vazio) ──────────
    fetch('/api/quiz/preview-data')
      .then(r => r.json())
      .then(d => { if (d.error) setErrorKind('no_session'); else setData(d) })
      .catch(() => setErrorKind(session ? 'calc_failed' : 'no_session'))
  }, [])


  if (errorKind) {
    const msgs: Record<ErrorKind, { emoji: string; title: string; body: string }> = {
      no_session: {
        emoji: '😕',
        title: 'No encontramos tu sesión',
        body: 'Parece que el quiz fue completado en otro dispositivo o la sesión expiró. Vuelve al quiz para continuar.',
      },
      calc_failed: {
        emoji: '⚠️',
        title: 'Error al calcular tu perfil',
        body: 'Tus respuestas están guardadas pero no pudimos generar el análisis. Intenta de nuevo o vuelve al quiz.',
      },
      network: {
        emoji: '📡',
        title: 'Error de conexión',
        body: 'No se pudo cargar tu análisis. Verifica tu conexión a internet e intenta de nuevo.',
      },
    }
    const { emoji, title, body } = msgs[errorKind]
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 py-20 text-center px-6">
          <p className="text-3xl">{emoji}</p>
          <p className="font-bold text-gray-800">{title}</p>
          <p className="text-sm text-muted-foreground max-w-xs">{body}</p>
          <div className="flex gap-3 flex-wrap justify-center">
            {errorKind !== 'no_session' && (
              <button
                onClick={() => { setErrorKind(null); window.location.reload() }}
                className="inline-flex items-center gap-2 rounded-xl border border-primary px-5 py-3 text-sm font-bold text-primary"
              >
                Intentar de nuevo
              </button>
            )}
            <a href="/quiz/1" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">
              Volver al quiz →
            </a>
          </div>
        </div>
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-3 py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          <p className="text-sm text-muted-foreground">Cargando tu análisis…</p>
        </div>
      </PageShell>
    )
  }

  const { profile, targets } = data
  const imc = profile.weightKg && profile.heightCm
    ? profile.weightKg / Math.pow(profile.heightCm / 100, 2)
    : null
  const delta = Math.abs(targets.tdee - targets.targetCalories)
  const totalKcal = targets.macros.proteinG * 4 + targets.macros.carbsG * 4 + targets.macros.fatG * 9 || 1
  const sample = data.sample?.meals ?? []
  const personalized = data.sample?.personalized ?? false
  const isLoss = targets.goal === 'lose_fat' || targets.goal === 'perder_peso'
  const isGain = targets.goal === 'gain_muscle' || targets.goal === 'ganar_masa'

  return (
    <>
      <PageShell>
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="w-full max-w-lg px-4 pt-6 pb-5 text-center space-y-3">
        {/* Badge de conclusão */}
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_4px_14px_rgba(15,110,86,0.25)]">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
          Calibración Metabólica completada · solo para ti
        </div>

        {isLoss || isGain ? (
          <>
            <p className="text-sm font-semibold text-muted-foreground">Esto calculamos para tu cuerpo</p>
            <div className="flex items-center justify-center gap-3">
              <div className="text-center">
                <p className="text-[11px] text-gray-400">Tu gasto</p>
                <p className="font-display text-2xl font-black leading-none text-gray-400">{targets.tdee}</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-[#D85A30]">
                  <path d="M5 12h14M19 12l-6-6M19 12l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="whitespace-nowrap rounded-full bg-[#FAECE7] px-2 py-0.5 text-[11px] font-bold text-[#993C1D]">
                  {isLoss ? `−${delta}` : `+${delta}`} kcal
                </span>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-semibold text-primary">Tu meta</p>
                <p className="font-display text-5xl font-black leading-none text-primary">{targets.targetCalories}</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">kcal/día</p>
            <p className="text-base font-bold text-gray-800">
              {isLoss ? 'Un déficit pensado para ti, sin pasar hambre'
                : 'Un superávit pensado para ti, para ganar músculo'}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-muted-foreground">Tu cuerpo necesita</p>
            <p className="font-display leading-none">
              <span className="text-6xl font-black text-primary">{targets.targetCalories}</span>
              <span className="ml-2 text-xl font-bold text-gray-500">kcal/día</span>
            </p>
            <p className="text-base font-bold text-gray-800">Para mantener tu peso de forma saludable</p>
          </>
        )}
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
          Calculado solo para ti con la <span className="font-semibold text-gray-700">Calibración Metabólica</span>. Mira tu análisis completo abajo.
        </p>
        <p className="mx-auto max-w-xs text-sm font-semibold text-gray-800">
          Saber tu número es el primer paso. Convertirlo en resultados reales, cada día y sin pensar, es lo que hace tu plan.
        </p>
      </div>

      {/* ── Contenido ─────────────────────────────────────────── */}
      <div className="w-full max-w-lg px-4 pb-24 space-y-3">

        {/* Perfil + IMC agrupados */}
        <Card label="Tu perfil" icon={<User className="h-4 w-4 text-primary" />} badge={imc ? <ImcBadge imc={imc} /> : undefined}>
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={<Cake className="h-4 w-4" />}  label="Edad"      value={profile.age ? `${profile.age} años` : '—'} />
            <StatCard icon={<Scale className="h-4 w-4" />} label="Peso"      value={profile.weightKg ? `${profile.weightKg} kg` : '—'} />
            <StatCard icon={<Ruler className="h-4 w-4" />} label="Altura"    value={profile.heightCm ? `${profile.heightCm} cm` : '—'} />
            <StatCard icon={<Gauge className="h-4 w-4" />} label="IMC"       value={imc ? imc.toFixed(1) : '—'} accent />
            <StatCard icon={<Target className="h-4 w-4" />} label="Objetivo" value={GOAL_LABEL[targets.goal] ?? targets.goal} />
            <StatCard icon={<Zap className="h-4 w-4" />}   label="Actividad" value={ACTIVITY_LABEL[profile.activityLevel] ?? (profile.activityLevel || '—')} />
          </div>

          {imc && (
            <div className="border-t border-[#EAF2E6] pt-4">
              <ImcScale imc={imc} />
              <div className="flex justify-between text-[10px] font-medium text-muted-foreground mt-1">
                <span>Bajo peso</span><span>Normal</span><span>Sobrepeso</span><span>Obesidad</span>
              </div>
            </div>
          )}
        </Card>

        {/* Metabolismo */}
        <Card label="Tu metabolismo" icon={<Flame className="h-4 w-4 text-primary" />}>
          <div className="grid grid-cols-3 gap-2">
            <MetricCard label="TMB"  sub="en reposo"    value={targets.bmr}            />
            <MetricCard label="TDEE" sub="gasto diario" value={targets.tdee}           />
            <MetricCard label="Meta" sub="kcal/día"     value={targets.targetCalories} accent />
          </div>

          <div className={[
            'rounded-xl border px-4 py-3 text-sm leading-relaxed',
            isLoss ? 'border-blue-100 bg-blue-50 text-blue-900'
            : isGain ? 'border-green-100 bg-green-50 text-green-900'
            : 'border-[#D4E8D0] bg-[#EBF6E4] text-[#1e4d2e]',
          ].join(' ')}>
            {isLoss && (
              <>Tu plan tiene un <strong>déficit de {delta} kcal/día</strong>, equivale a ~{(delta * 7 / 7700).toFixed(1)} kg menos por semana.</>

            )}
            {isGain && (
              <>Tu plan tiene un <strong>superávit de {delta} kcal/día</strong> sobre tu gasto diario para construir músculo.</>
            )}
            {!isLoss && !isGain && (
              <>Tu meta calórica está alineada con tu gasto para <strong>mantener tu peso</strong> de forma saludable.</>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            La <span className="font-semibold text-gray-700">Calibración Metabólica</span> calcula tu gasto con la ecuación Mifflin-St Jeor,
            el estándar clínico, ajustada a tu nivel de actividad por un nutriólogo.
          </p>
        </Card>

        {/* Macros */}
        <Card label="Distribución de macronutrientes" icon={<PieChart className="h-4 w-4 text-primary" />}>
          <div className="flex items-center gap-5">
            <MacroDonut macros={targets.macros} />
            <div className="flex-1 space-y-2.5">
              <MacroRow color="#EF4444" label="Proteína"      g={targets.macros.proteinG} kcalPerG={4} total={totalKcal} />
              <MacroRow color="#22C55E" label="Carbohidratos" g={targets.macros.carbsG}   kcalPerG={4} total={totalKcal} />
              <MacroRow color="#FACC15" label="Grasas"        g={targets.macros.fatG}     kcalPerG={9} total={totalKcal} />
            </div>
          </div>
        </Card>

        {/* Vista previa real del plan */}
        <div className="space-y-2">
          <div className="flex items-end justify-between px-1">
            <div>
              <p className="text-sm font-black text-gray-900">Tu Calibración Metabólica en acción</p>
              <p className="text-[11px] text-muted-foreground">Día 1 · {targets.targetCalories} kcal · para tu cuerpo</p>
            </div>
            <span className="rounded-full bg-primary/8 px-2.5 py-1 text-xs font-bold text-primary">7 días</span>
          </div>

          <div className="overflow-hidden rounded-2xl border-2 border-dashed border-primary/25 bg-white p-3">
            <div className="space-y-2.5">
              {/* Refeições reais do Día 1, montadas com os alimentos que ela escolheu */}
              {sample.map((meal) => (
                <TeaserMeal key={meal.name} meal={meal} />
              ))}
            </div>

            {/* Lock: prova que há muito mais (días 2-7, otras comidas, lista) — travado */}
            <div className="mt-3 flex flex-col items-center gap-2.5 rounded-xl border border-primary/15 bg-[#F5FAF2] px-4 py-3.5 text-center">
              <div className="flex flex-wrap justify-center gap-1.5">
                {[
                  { Icon: Sunrise,      label: 'Desayunos' },
                  { Icon: Utensils,     label: 'Almuerzos' },
                  { Icon: Moon,         label: 'Cenas' },
                  { Icon: Apple,        label: 'Snacks' },
                  { Icon: ShoppingCart, label: 'Lista de compras' },
                ].map(({ Icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    <Icon className="h-3 w-3" /> {label}
                  </span>
                ))}
              </div>
              <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-800">
                <Lock className="h-3.5 w-3.5 text-primary" /> Los 7 días completos al desbloquear tu plan
              </p>
            </div>
          </div>

          {/* Loop: reforça personalização (ou comida confiável) + variedade dos 7 días */}
          <p className="px-1 text-center text-[11px] leading-relaxed text-muted-foreground">
            {personalized ? (
              <>Armado con los alimentos que <span className="font-semibold text-gray-600">tú elegiste</span>. Los 7 días varían para que no te aburras.</>
            ) : (
              <>Comida común del día a día, ajustada a <span className="font-semibold text-gray-600">tu meta</span>. Los 7 días varían para que no te aburras.</>
            )}
          </p>
        </div>

        {/* Por que a CM funciona quando outras dietas falharam — Estágio 4: nomeia o mecanismo do problema */}
        <div className="rounded-2xl border border-[#D8E8D4] bg-white p-4 space-y-3">
          <div className="text-center space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Por qué otras dietas fallaron (y esta no)</p>
            <p className="font-display text-[15px] font-black text-gray-900">El problema nunca fuiste tú. Fue el método.</p>
          </div>
          <div className="space-y-2">
            {[
              {
                label: 'Keto',
                why: `Te quitó los carbohidratos sin saber cuánto quema tu cuerpo. Tu TMB real es ${targets.bmr} kcal. Keto no lo calcula.`,
              },
              {
                label: 'Contar calorías',
                why: `Te dieron 1.200 kcal genéricas cuando tu gasto real es ${targets.tdee} kcal. La diferencia te dejaba con hambre y sin resultados.`,
              },
              {
                label: 'La dieta de la influencer',
                why: 'Funciona para el cuerpo de ella. No para el tuyo. Tú tienes tu propio metabolismo, tu actividad y tu objetivo.',
              },
            ].map(({ label, why }) => (
              <div key={label} className="rounded-xl border border-[#EAF2E6] bg-[#F5FAF2] px-3.5 py-2.5 space-y-0.5">
                <p className="text-xs font-bold text-[#993C1D] line-through">{label}</p>
                <p className="text-[11px] text-gray-600 leading-relaxed">{why}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-center text-muted-foreground leading-relaxed pt-1">
            La <span className="font-semibold text-gray-700">Calibración Metabólica</span> usa tus números reales. Los que calculaste arriba son tuyos, no de otra persona.
          </p>
        </div>

        {/* Resultados reales — antes/después (fotos con consentimiento) */}
        <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-3.5 shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
          <div className="space-y-1 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Resultados reales con la Calibración Metabólica
            </p>
            <p className="font-display text-base font-black text-gray-900">
              Así les fue a ellas
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {RESULTS.map(({ photo, name, country, age, result, w, h }) => (
              <div key={name} className="overflow-hidden rounded-xl border border-[#D8E8D4] bg-[#F5FAF2]">
                <Image
                  src={photo}
                  alt={`Antes y después de ${name}`}
                  width={w}
                  height={h}
                  className="h-auto w-full"
                />
                <div className="space-y-1 p-2.5">
                  <span className="inline-block rounded-full bg-primary px-2 py-0.5 text-[11px] font-black text-white">
                    {result}
                  </span>
                  <p className="text-xs font-bold text-gray-800">{country} {name}, {age}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-[10px] leading-relaxed text-[#B7C3B2]">
            Resultados individuales. Varían según cada persona, su constancia y su punto de partida.
          </p>
        </div>

        {/* Social proof */}
        <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-3">
          <p className="text-center font-display text-[15px] font-bold text-gray-900">
            Lo que dicen quienes ya lo tienen
          </p>
          {[
            { photo: '/testimonios/maria.png',  name: 'María G.',  country: '🇲🇽', text: 'Bajé 4 kg en el primer mes. Por fin sé exactamente qué comer sin contar calorías a mano.' },
            { photo: '/testimonios/andrea.png', name: 'Lucía M.',  country: '🇨🇴', text: 'Ya no me siento culpable cuando como. El plan me enseñó cuánto necesita mi cuerpo y bajé 4 kg en un mes sin pasar hambre.' },
            { photo: '/testimonios/ana.png',    name: 'Ana P.',    country: '🇪🇸', text: 'Comida real, sin pasar hambre. En 3 semanas ya me sentía con más energía y sin antojos.' },
          ].map(({ photo, name, country, text }) => (
            <div key={name} className="rounded-xl border border-[#D8E8D4] bg-[#F5FAF2] p-3.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <Image
                  src={photo}
                  alt={name}
                  width={36}
                  height={36}
                  className="h-9 w-9 shrink-0 rounded-full object-cover object-top"
                />
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="10" height="10" viewBox="0 0 11 11" fill="#f59e0b">
                      <path d="M5.5 1l1.1 3.3H10L7.2 6.4l1 3.1L5.5 7.7 2.8 9.5l1-3.1L1 4.3h3.4z" />
                    </svg>
                  ))}
                </div>
              </div>
              <p className="text-sm leading-relaxed text-gray-700">"{text}"</p>
              <p className="text-xs font-bold text-primary">{country} {name}</p>
            </div>
          ))}
        </div>

        {/* Progressão das 4 semanas — âncora de valor antes da oferta */}
        <div className="overflow-hidden rounded-2xl border border-[#D8E8D4] bg-white">
          <div className="bg-primary/10 px-5 py-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Por qué 4 semanas cambian todo</p>
            <p className="mt-0.5 text-[15px] font-black text-gray-900">Tu cuerpo cambia en etapas, no de golpe</p>
          </div>
          <div className="space-y-1 p-4">

            {/* Sem 1-2 */}
            <div className="flex items-start gap-3 rounded-xl px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[#D8E8D4] bg-[#EAF3DE]">
                <span className="text-[10px] font-black text-primary">1-2</span>
              </div>
              <div className="pt-0.5">
                <p className="text-sm font-bold text-gray-900">Adaptación</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">Tu metabolismo aprende el nuevo ritmo sin hambre extrema. Tu cuerpo empieza a confiar en el plan.</p>
              </div>
            </div>

            <div className="flex justify-center py-0.5">
              <div className="h-5 w-px bg-[#D8E8D4]" />
            </div>

            {/* Sem 3 — destaque */}
            <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary">
                <span className="text-[10px] font-black text-white">3</span>
              </div>
              <div className="pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-gray-900">Aceleración</p>
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Aquí cambia todo</span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">La Calibración ajusta tus calorías con base en tu progreso real. El plan se recalibra para tu cuerpo actual y los resultados se aceleran.</p>
              </div>
            </div>

            <div className="flex justify-center py-0.5">
              <div className="h-5 w-px bg-[#D8E8D4]" />
            </div>

            {/* Sem 4 */}
            <div className="flex items-start gap-3 rounded-xl px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[#D8E8D4] bg-[#EAF3DE]">
                <span className="text-[10px] font-black text-primary">4</span>
              </div>
              <div className="pt-0.5">
                <p className="text-sm font-bold text-gray-900">Consolidación</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">Tu metabolismo se estabiliza. Los hábitos quedan. Sin efecto rebote.</p>
              </div>
            </div>

          </div>
          <div className="border-t border-[#D8E8D4] bg-[#F5FAF2] px-5 py-3">
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              El plan de 1 semana te da el primer paso. El de 4 semanas{' '}
              <span className="font-semibold text-gray-700">te lleva hasta el resultado real.</span>
            </p>
          </div>
        </div>

        {/* Oferta con ancla de valor */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-white shadow-[0_10px_34px_rgba(15,110,86,0.13)]">
          {/* Selo de desconto */}
          <div className="absolute right-3 top-3 z-10 rounded-full bg-[#D85A30] px-2.5 py-1 text-xs font-black text-white shadow-sm">
            -79%
          </div>

          {/* Header colorido */}
          <div className="bg-primary px-5 py-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Método Calibración Metabólica</p>
            <p className="text-base font-black text-white">
              {isLoss ? '¡Tu Calibración está lista. Empieza a adelgazar!'
                : isGain ? '¡Tu Calibración está lista. Empieza a ganar músculo!'
                : '¡Tu Calibración Metabólica exacta está lista!'}
            </p>
          </div>

          {/* Urgência */}
          <Countdown />

          <div className="p-5 space-y-4">
            {/* Mecanismo Único — destacado como THE product, não como feature */}
            <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <div>
                <p className="text-sm font-bold text-gray-900">Calibración Metabólica validada por nutriólogo</p>
                <p className="text-[11px] text-muted-foreground">Calcula exactamente lo que <em>tu</em> cuerpo necesita, no una fórmula genérica</p>
              </div>
            </div>
            <ul className="space-y-2.5">
              {[
                { item: 'Plan de 4 semanas personalizado',  value: '$59' },
                { item: 'Lista de compras semanal (×4)',    value: '$12' },
                { item: 'Guía de implementación',           value: '$14' },
                { item: 'Sustituciones para cada comida',   value: '$12' },
                { item: 'Acceso a tu panel personal + PDF', value: 'incluido' },
              ].map(({ item, value }) => (
                <li key={item} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-gray-700">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {item}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">{value}</span>
                </li>
              ))}
            </ul>

            {/* Price box — hero 4 semanas */}
            <div className="rounded-xl border border-[#D8E8D4] bg-[#F5FAF2] p-4 text-center space-y-1">
              <span className="inline-block rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold text-white">más elegido</span>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">Valor total <span className="line-through">$97</span></span>
                <span className="rounded-full bg-[#FBE7DF] px-2 py-0.5 text-[11px] font-bold text-[#993C1D]">Ahorras $77</span>
              </div>
              <p className="leading-none">
                <span className="text-5xl font-black text-gray-900">$5</span>
                <span className="text-xl font-bold text-muted-foreground">/semana</span>
              </p>
              <p className="text-sm font-bold text-primary">Pago único de $19.90 USD · sin suscripción</p>
              <p className="flex items-center justify-center gap-1 text-xs font-semibold text-muted-foreground">
                <Coffee className="h-3.5 w-3.5" /> ≈ $0.71 al día · menos que un café
              </p>
            </div>

            {ctaState === 'error' && (
              <p className="text-center text-xs text-red-600">
                Error al preparar el pedido. Recarga la página e intenta de nuevo.
              </p>
            )}

            {/* CTA primário — 4 semanas */}
            <button
              onClick={() => handleCta('4weeks')}
              disabled={ctaState === 'loading'}
              className={[
                'flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-black text-white',
                'bg-[#D85A30] shadow-[0_4px_20px_0_rgba(216,90,48,0.38)] transition-all duration-150',
                'hover:shadow-[0_6px_28px_0_rgba(216,90,48,0.48)] hover:brightness-[1.05] active:scale-[0.99]',
                'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
              ].join(' ')}
            >
              {ctaState === 'loading' ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                  Procesando…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 opacity-80" />
                  Desbloquear mis 4 semanas
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="opacity-80">
                    <path d="M3.5 7.5H11.5M11.5 7.5L7.5 3.5M11.5 7.5L7.5 11.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>

            {/* Trust signals logo abaixo do CTA — reforçam a decisão no ponto certo */}
            <PaymentTrust />

            {/* Downsell — 1 semana, como opção de entrada visível (não link escondido) */}
            <div className="pt-3 border-t border-dashed border-[#D8E8D4]">
              <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                ¿Prefieres empezar de a poco?
              </p>
              <button
                onClick={() => handleCta('standard')}
                disabled={ctaState === 'loading'}
                className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-primary/30 bg-white px-4 py-3 text-left transition-all hover:border-primary/55 hover:bg-[#F5FAF2] active:scale-[0.99] disabled:opacity-50"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900">Plan de 1 semana</span>
                  <span className="text-[11px] text-muted-foreground">Para probar el método antes</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="text-lg font-black text-primary">$9.90</span>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="text-primary">
                    <path d="M3.5 7.5H11.5M11.5 7.5L7.5 3.5M11.5 7.5L7.5 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Garantía */}
        <div className="flex items-center gap-3 rounded-2xl border border-[#D8E8D4] bg-[#F5FAF2] p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D8E8D4] bg-white">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Garantía total de 30 días</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Si no te encanta tu plan, te devolvemos el 100%. Sin preguntas.
            </p>
          </div>
        </div>

        <FaqSection />

        {/* CTA final — após perguntas frequentes */}
        <div className="space-y-3 pb-10">
          <button
            onClick={() => handleCta('4weeks')}
            disabled={ctaState === 'loading'}
            className={[
              'flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-black text-white',
              'bg-[#D85A30] shadow-[0_4px_20px_0_rgba(216,90,48,0.38)] transition-all duration-150',
              'hover:shadow-[0_6px_28px_0_rgba(216,90,48,0.48)] hover:brightness-[1.05] active:scale-[0.99]',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
            ].join(' ')}
          >
            {ctaState === 'loading' ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                Procesando…
              </>
            ) : (
              'Desbloquear mis 4 semanas · $19.90 →'
            )}
          </button>
          <PaymentTrust />
        </div>

      </div>
    </PageShell>
    </>
  )
}

// ---------------------------------------------------------------------------
// FAQ — quebra as 5 objeções mais comuns antes do CTA final
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    q: '¿En qué se diferencia de otras dietas que ya probé?',
    a: 'Las dietas genéricas usan las mismas reglas para todo el mundo. La Calibración Metabólica calcula tu gasto basal real (TMB), lo ajusta a tu nivel de actividad y lo convierte en un plan de comida cotidiana, sin restricciones extremas ni conteo de calorías. No le das a tu cuerpo "lo que le funciona a otra persona". Le das exactamente lo que él necesita.',
  },
  {
    q: '¿Funciona si tengo hipotiroidismo o diabetes?',
    a: 'Sí. Los cálculos se basan en tu metabolismo real y tu nivel de actividad. Si tienes una condición médica, el plan incluye un aviso para validar con tu médico.',
  },
  {
    q: '¿Tengo que pesar la comida?',
    a: 'No. Cada comida viene con medidas caseras: tazas, cucharadas y porciones visuales. Sin balanza.',
  },
  {
    q: '¿Puedo comer fuera de casa o en restaurantes?',
    a: 'Sí. El plan incluye sustituciones y equivalencias para adaptar a lo que tengas en casa o pidas en un restaurante.',
  },
  {
    q: '¿Qué pasa si no me gusta el plan?',
    a: 'Tienes garantía total de 30 días. Si no te convence, te devolvemos el 100%, sin preguntas.',
  },
  {
    q: '¿En cuánto tiempo veo resultados?',
    a: 'Depende de tu objetivo y tu cuerpo, pero la mayoría de usuarios reporta cambios visibles en 3 a 4 semanas siguiendo el plan.',
  },
]

function FaqSection() {
  return (
    <div className="rounded-2xl border border-[#D8E8D4] bg-white shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
      <div className="flex items-center gap-2 border-b border-[#EAF2E6] px-5 py-3">
        <p className="font-display text-[15px] font-bold text-gray-900">
          Preguntas frecuentes
        </p>
      </div>
      <div className="divide-y divide-[#EAF2E6]">
        {FAQ_ITEMS.map(({ q, a }) => (
          <details key={q} className="group px-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 py-3.5 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              <span>{q}</span>
              <span className="mt-0.5 shrink-0 text-xl font-light text-primary leading-none transition-transform duration-150 group-open:rotate-45">+</span>
            </summary>
            <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
          </details>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contador de urgência — preço especial expira (persiste na sessão)
// ---------------------------------------------------------------------------

function Countdown() {
  const [secs, setSecs] = useState<number | null>(null)

  useEffect(() => {
    const KEY = 'nutriplan_offer_deadline'
    let deadline = Number(sessionStorage.getItem(KEY))
    if (!deadline || deadline < Date.now()) {
      deadline = Date.now() + 10 * 60 * 1000 // 10 minutos
      sessionStorage.setItem(KEY, String(deadline))
    }
    const tick = () => setSecs(Math.max(0, Math.round((deadline - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (secs === null) return null

  // Quando o contador zera, não congelamos em "00:00" (parece fake e quebra
  // a credibilidade). Trocamos por uma mensagem de escassez honesta e estável.
  if (secs === 0) {
    return (
      <div className="flex items-center justify-center gap-2 bg-[#FBE7DF] py-2">
        <Clock className="h-3.5 w-3.5 text-[#993C1D]" />
        <span className="text-xs font-semibold text-[#993C1D]">
          Tu precio especial está reservado solo por hoy
        </span>
      </div>
    )
  }

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  return (
    <div className="flex items-center justify-center gap-2 bg-[#FBE7DF] py-2">
      <Clock className="h-3.5 w-3.5 text-[#993C1D]" />
      <span className="text-xs font-semibold text-[#993C1D]">
        Tu precio especial expira en {mm}:{ss}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trust signals (logos de pago + badges) — vão logo abaixo do CTA principal
// ---------------------------------------------------------------------------

function PaymentTrust() {
  return (
    <div className="space-y-2">
      {/* Logos de bandeiras */}
      <div className="flex items-center justify-center gap-2 pt-0.5">
        {/* VISA */}
        <div className="flex h-7 w-12 items-center justify-center rounded-md border border-[#E0E0DA] bg-white">
          <svg viewBox="0 0 48 16" width="36" height="12" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="13" fontFamily="Arial" fontSize="16" fontWeight="900" fontStyle="italic" fill="#1A1F71">VISA</text>
          </svg>
        </div>
        {/* Mastercard */}
        <div className="flex h-7 w-12 items-center justify-center rounded-md border border-[#E0E0DA] bg-white">
          <svg viewBox="0 0 38 24" width="32" height="20" xmlns="http://www.w3.org/2000/svg">
            <circle cx="13" cy="12" r="11" fill="#EB001B"/>
            <circle cx="25" cy="12" r="11" fill="#F79E1B"/>
            <path d="M19 3.5a11 11 0 0 1 0 17 11 11 0 0 1 0-17z" fill="#FF5F00"/>
          </svg>
        </div>
        {/* PayPal */}
        <div className="flex h-7 w-14 items-center justify-center rounded-md border border-[#E0E0DA] bg-white px-1">
          <svg viewBox="0 0 60 20" width="44" height="14" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" fontFamily="Arial" fontSize="15" fontWeight="bold" fill="#003087">Pay</text>
            <text x="28" y="15" fontFamily="Arial" fontSize="15" fontWeight="bold" fill="#009CDE">Pal</text>
          </svg>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Pago seguro</span>
        <span className="h-3 w-px bg-border" />
        <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Acceso inmediato</span>
        <span className="h-3 w-px bg-border" />
        <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Garantía 30 días</span>
      </div>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Shell da página com header de marca
// ---------------------------------------------------------------------------

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'linear-gradient(180deg, hsl(148,38%,90%) 0px, hsl(120,24%,95%) 110px, hsl(40,32%,97%) 320px)',
      }}
    >
      {/* Header fixo com marca */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-center border-b border-[#D4E8D0] bg-white/85 backdrop-blur-md">
        <NutriWordmark size="md" />
      </header>

      <div className="flex flex-col items-center">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componentes internos
// ---------------------------------------------------------------------------

function Card({
  label,
  icon,
  badge,
  children,
}: {
  label: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[#D8E8D4] bg-white shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
      <div className="flex items-center justify-between border-b border-[#EAF2E6] px-5 py-3">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-sm">{icon}</span>
          )}
          <p className="font-display text-[15px] font-bold text-gray-900">{label}</p>
        </div>
        {badge}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={[
      'rounded-xl border p-3 text-center',
      accent ? 'border-primary/25 bg-primary/5' : 'border-[#E0EDD9] bg-[#FAFCF8]',
    ].join(' ')}>
      <div className="flex justify-center text-primary">{icon}</div>
      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-1">{label}</p>
      <p className={['mt-0.5 text-xs font-bold leading-tight', accent ? 'text-primary' : 'text-gray-800'].join(' ')}>{value}</p>
    </div>
  )
}

function ImcBadge({ imc }: { imc: number }) {
  const { label, cls } =
    imc < 18.5 ? { label: 'Bajo peso', cls: 'border-blue-100 bg-blue-50 text-blue-700' }
    : imc < 25  ? { label: 'Normal',    cls: 'border-green-100 bg-green-50 text-green-700' }
    : imc < 30  ? { label: 'Sobrepeso', cls: 'border-yellow-100 bg-yellow-50 text-yellow-700' }
    :              { label: 'Obesidad',  cls: 'border-red-100 bg-red-50 text-red-700' }
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cls}`}>
      {imc.toFixed(1)} · {label}
    </span>
  )
}

function ImcScale({ imc }: { imc: number }) {
  const pct = Math.max(2, Math.min(96, ((imc - 10) / 30) * 100))
  return (
    <div className="relative pt-5">
      <div
        className="absolute -translate-x-1/2 text-base leading-none text-[#D85A30] drop-shadow-sm"
        style={{ left: `${pct}%`, top: 0 }}
      >▼</div>
      <div
        className="h-3 rounded-full"
        style={{ background: 'linear-gradient(to right, #93c5fd 0%, #4ade80 32%, #fde047 62%, #f87171 100%)' }}
      />
    </div>
  )
}

function MetricCard({ label, sub, value, accent }: { label: string; sub: string; value: number; accent?: boolean }) {
  if (accent) {
    return (
      <div className="rounded-xl bg-primary p-3 text-center shadow-[0_4px_14px_rgba(15,110,86,0.25)]">
        <p className="text-xs font-black text-white">{label}</p>
        <p className="text-[10px] text-white/75 mb-1">{sub}</p>
        <p className="text-xl font-black text-white">{value}</p>
        <p className="text-[10px] text-white/75">kcal</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-[#E0EDD9] bg-[#FAFCF8] p-3 text-center">
      <p className="text-xs font-black text-gray-700">{label}</p>
      <p className="text-[10px] text-muted-foreground mb-1">{sub}</p>
      <p className="text-xl font-black text-gray-900">{value}</p>
      <p className="text-[10px] text-muted-foreground">kcal</p>
    </div>
  )
}

function MacroDonut({ macros }: { macros: { proteinG: number; carbsG: number; fatG: number } }) {
  const r = 44, circ = 2 * Math.PI * r
  const pK = macros.proteinG * 4, cK = macros.carbsG * 4, fK = macros.fatG * 9
  const total = pK + cK + fK || 1
  const segs = [
    { color: '#EF4444', len: (pK / total) * circ }, // Proteína
    { color: '#22C55E', len: (cK / total) * circ }, // Carbohidratos
    { color: '#FACC15', len: (fK / total) * circ }, // Grasas
  ]
  let acc = 0
  const arcs = segs.map((s) => {
    const off = acc
    acc += s.len
    return { ...s, off }
  })
  return (
    <svg className="-rotate-90 shrink-0" width="108" height="108" viewBox="0 0 108 108">
      <circle cx="54" cy="54" r={r} fill="none" stroke="#E0EDD9" strokeWidth="14" />
      {arcs.map((a, i) => (
        <circle
          key={i}
          cx="54" cy="54" r={r} fill="none" stroke={a.color} strokeWidth="14"
          strokeDasharray={`${a.len} ${circ - a.len}`}
          strokeDashoffset={-a.off}
        />
      ))}
    </svg>
  )
}

function MacroRow({ color, label, g, kcalPerG, total }: {
  color: string; label: string; g: number; kcalPerG: number; total: number
}) {
  const pct = Math.round((g * kcalPerG) / total * 100)
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="flex-1 text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-bold text-gray-800">{g}g</span>
        <span className="w-8 text-right text-[10px] text-muted-foreground">({pct}%)</span>
      </div>
      <div className="h-1 w-full rounded-full bg-border ml-4">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
