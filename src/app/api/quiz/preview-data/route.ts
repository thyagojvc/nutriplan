import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { parseAnswers } from '@/lib/nutrition/answers'
import { calcTargets } from '@/lib/nutrition/math'

// Fatores de atividade — espelho dos valores definidos no quiz (step6-activity.tsx).
const ACTIVITY_FACTORS: Record<string, number> = {
  sedentario: 1.2,
  ligeramente_activo: 1.375,
  moderadamente_activo: 1.55,
  muy_activo: 1.725,
}

// Garante que draft.step_6 sempre tenha activity_factor para o parseAnswers.
// Caso o sessionStorage não tenha o campo (dados muito antigos ou serialização
// parcial), deriva o fator a partir do activity_level.
function normalizeDraft(draft: Record<string, unknown>): Record<string, unknown> {
  const s6 = (draft.step_6 ?? {}) as Record<string, unknown>
  if (s6.activity_factor == null && s6.activity_level) {
    const factor = ACTIVITY_FACTORS[String(s6.activity_level)]
    if (factor) {
      return { ...draft, step_6: { ...s6, activity_factor: factor } }
    }
  }
  return draft
}

// Monta a resposta de preview a partir de um draft_answers + country.
// Compartilhado pelo GET (lê do banco via cookie) e pelo POST (recebe do cliente
// via sessionStorage). Lança em caso de dados físicos incompletos.
function buildPreview(draft: Record<string, unknown>, country: string) {
  draft = normalizeDraft(draft)
  const answers = parseAnswers(draft, country)
  const targets = calcTargets(answers)

  const s4 = (draft.step_4 ?? {}) as Record<string, unknown>
  const s5 = (draft.step_5 ?? {}) as Record<string, unknown>
  const s6 = (draft.step_6 ?? {}) as Record<string, unknown>

  return {
    profile: {
      age: Number(s5.age) || null,
      weightKg: Number(s5.weight_kg) || null,
      heightCm: Number(s5.height_cm) || null,
      sex: String(s4.sex ?? ''),
      activityLevel: String(s6.activity_level ?? ''),
    },
    targets: {
      bmr: targets.bmr,
      tdee: targets.tdee,
      targetCalories: targets.targetCalories,
      goal: targets.goal,
      macros: targets.macros,
    },
  }
}

// POST: cliente envia o draft montado a partir do sessionStorage.
// Caminho primário do /preview — não depende de cookie nem de round-trip ao banco.
export async function POST(request: NextRequest) {
  let body: { draft_answers?: Record<string, unknown>; country?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const draft = body.draft_answers
  if (!draft || typeof draft !== 'object') {
    return NextResponse.json({ error: 'no_answers' }, { status: 400 })
  }

  try {
    return NextResponse.json(buildPreview(draft, body.country || 'OTHER'))
  } catch {
    return NextResponse.json({ error: 'calc_failed' }, { status: 422 })
  }
}

// GET: fallback via cookie + banco (ex.: reabrir /preview numa aba nova sem sessionStorage).
export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('nutriplan_session_id')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: session } = await supabase
    .from('generation_sessions')
    .select('draft_answers, country')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session?.draft_answers) {
    return NextResponse.json({ error: 'no_answers' }, { status: 404 })
  }

  try {
    return NextResponse.json(
      buildPreview(
        session.draft_answers as Record<string, unknown>,
        (session.country as string) ?? 'OTHER',
      ),
    )
  } catch {
    return NextResponse.json({ error: 'calc_failed' }, { status: 422 })
  }
}
