import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { parseAnswers } from '@/lib/nutrition/answers'
import { calculateTargets } from '@/lib/nutrition/math'

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
    const answers = parseAnswers(
      session.draft_answers as Record<string, unknown>,
      (session.country as string) ?? 'OTHER',
    )
    const targets = calculateTargets(answers)

    const d = session.draft_answers as Record<string, unknown>
    const s4 = (d.step_4 ?? {}) as Record<string, unknown>
    const s5 = (d.step_5 ?? {}) as Record<string, unknown>
    const s6 = (d.step_6 ?? {}) as Record<string, unknown>

    return NextResponse.json({
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
    })
  } catch {
    return NextResponse.json({ error: 'calc_failed' }, { status: 422 })
  }
}
