'use client'

// =============================================================================
// /mi-plan — carga dos dados.
//
// O plano é gerado NO CLIENTE com o mesmo gerador determinístico que roda no
// pós-compra (process-order.ts). Não é uma maquete: é literalmente o plano que
// ela vai receber. Se algum dia a geração virar chamada de IA, esta página tem
// que passar a buscar o plano do servidor, senão a promessa "é o teu plano"
// deixa de ser verdade.
//
// planWeeks TEM que ser o mesmo de process-order.ts (hoje 4). É o que sustenta
// a promessa "este é o teu plano": se divergir, a página mostra um mês e a
// entrega manda uma semana.
// =============================================================================

import { useEffect, useState } from 'react'
import { parseAnswers } from '@/lib/nutrition/answers'
import { calcTargets } from '@/lib/nutrition/math'
import { generateNutritionPlan, generateTrainingPlan, type TrainingPlanJson } from '@/lib/nutrition/generate'
import type { NutritionPlanJson } from '@/lib/nutrition/types'
import type { Profile } from '@/app/(dashboard)/dashboard/dashboard-ui'
import { NutriWordmark } from '@/app/quiz/[step]/quiz-ui'
import { MiPlanApp } from './mi-plan-app'

const ACTIVITY_FACTORS: Record<string, number> = {
  sedentario: 1.2,
  ligeramente_activo: 1.375,
  moderadamente_activo: 1.55,
  muy_activo: 1.725,
}

interface Loaded {
  plan: NutritionPlanJson
  profile: Profile
  trainingPlan: TrainingPlanJson | null
  noTraining: boolean
  hasTrainingAnswer: boolean
}

type ErrorKind = 'no_session' | 'calc_failed'

/** Lê o draft do sessionStorage (preenchido passo a passo durante o quiz). */
function readLocalDraft(): { draft: Record<string, unknown>; country: string } | null {
  try {
    const draft: Record<string, unknown> = {}
    for (let n = 1; n <= 10; n++) {
      const raw = sessionStorage.getItem(`nutriplan_step_${n}`)
      if (raw) draft[`step_${n}`] = JSON.parse(raw)
    }
    const s5 = (draft.step_5 ?? {}) as Record<string, unknown>
    if (!s5.age || !s5.weight_kg || !s5.height_cm) return null

    let country = 'OTHER'
    const raw7 = sessionStorage.getItem('nutriplan_step_7')
    if (raw7) {
      const s7 = JSON.parse(raw7) as { country?: string }
      if (s7.country) country = s7.country
    }
    return { draft, country }
  } catch {
    return null
  }
}

/** Deriva activity_factor quando o passo 6 foi salvo por uma versão antiga. */
function normalizeDraft(draft: Record<string, unknown>): Record<string, unknown> {
  const s6 = (draft.step_6 ?? {}) as Record<string, unknown>
  if (s6.activity_factor == null && s6.activity_level) {
    const f = ACTIVITY_FACTORS[String(s6.activity_level)]
    if (f) return { ...draft, step_6: { ...s6, activity_factor: f } }
  }
  return draft
}

async function build(rawDraft: Record<string, unknown>, country: string): Promise<Loaded> {
  const draft = normalizeDraft(rawDraft)
  const answers = parseAnswers(draft, country)
  const targets = calcTargets(answers)

  const s4 = (draft.step_4 ?? {}) as Record<string, unknown>
  const s5 = (draft.step_5 ?? {}) as Record<string, unknown>
  const s6 = (draft.step_6 ?? {}) as Record<string, unknown>
  const s10 = (draft.step_10 ?? {}) as Record<string, unknown>

  const plan = await generateNutritionPlan(answers, targets, 1, undefined, 4)
  const trainingPlan = await generateTrainingPlan(answers)

  return {
    plan,
    profile: {
      age: Number(s5.age) || null,
      weightKg: Number(s5.weight_kg) || null,
      heightCm: Number(s5.height_cm) || null,
      sex: String(s4.sex ?? ''),
      activityLevel: String(s6.activity_level ?? ''),
    },
    trainingPlan,
    noTraining: s10.experience === 'no_ejercicio',
    hasTrainingAnswer: !!s10.experience,
  }
}

export default function MiPlanPage() {
  const [data, setData] = useState<Loaded | null>(null)
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Caminho 1: sessionStorage, sem rede.
      const local = readLocalDraft()
      if (local) {
        try {
          const built = await build(local.draft, local.country)
          if (!cancelled) setData(built)
          return
        } catch {
          // dados inválidos: tenta o banco antes de desistir
        }
      }

      // Caminho 2: draft do banco pelo cookie da sessão (aba nova, storage vazio).
      try {
        const r = await fetch('/api/quiz/draft')
        if (!r.ok) { if (!cancelled) setErrorKind('no_session'); return }
        const d = await r.json() as { draft_answers?: Record<string, unknown>; country?: string }
        if (!d.draft_answers) { if (!cancelled) setErrorKind('no_session'); return }
        const built = await build(d.draft_answers, d.country ?? 'OTHER')
        if (!cancelled) setData(built)
      } catch {
        if (!cancelled) setErrorKind(local ? 'calc_failed' : 'no_session')
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (errorKind) {
    const msg = errorKind === 'no_session'
      ? {
          emoji: '😕',
          title: 'No encontramos tu sesión',
          body: 'Parece que el quiz fue completado en otro dispositivo o la sesión expiró. Vuelve al quiz para continuar.',
        }
      : {
          emoji: '⚠️',
          title: 'Error al armar tu plan',
          body: 'Tus respuestas están guardadas pero no pudimos generar el plan. Intenta de nuevo o vuelve al quiz.',
        }
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
          <p className="text-3xl">{msg.emoji}</p>
          <p className="font-bold text-gray-800">{msg.title}</p>
          <p className="max-w-xs text-sm text-muted-foreground">{msg.body}</p>
          <div className="flex flex-wrap justify-center gap-3">
            {errorKind !== 'no_session' && (
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-xl border border-primary px-5 py-3 text-sm font-bold text-primary"
              >
                Intentar de nuevo
              </button>
            )}
            <a href="/quiz/5" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white">
              Volver al quiz →
            </a>
          </div>
        </div>
      </Shell>
    )
  }

  if (!data) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          <p className="text-sm text-muted-foreground">Abriendo tu plan…</p>
        </div>
      </Shell>
    )
  }

  return (
    <MiPlanApp
      plan={data.plan}
      profile={data.profile}
      trainingPlan={data.trainingPlan}
      noTraining={data.noTraining}
      hasTrainingAnswer={data.hasTrainingAnswer}
    />
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FBFAF6] font-poppins">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-center border-b border-[#EAF2E6] bg-[#FBFAF6]/95 backdrop-blur-md">
        <NutriWordmark size="md" />
      </header>
      <div className="flex flex-col items-center">{children}</div>
    </div>
  )
}
