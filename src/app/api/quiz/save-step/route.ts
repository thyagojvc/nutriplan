import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const bodySchema = z.object({
  step: z.number().int().min(1).max(12),
  answers: z.record(z.unknown()),
  // country chegará apenas no step 7; omitido nos demais
  country: z.string().optional(),
})

// Auto-save de cada step do quiz.
// Usa save_quiz_draft_step (migration 0013) para merge atômico com jsonb ||.
// Merge é shallow: 'step_N' é chave atômica — não suporta edição parcial intra-step.
export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('nutriplan_session_id')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
  }

  const { step, answers, country } = parsed.data
  const supabase = createServiceClient()

  const { error } = await supabase.rpc('save_quiz_draft_step', {
    p_session_id: sessionId,
    p_step: step,
    p_answers: answers,
    ...(country !== undefined ? { p_country: country } : {}),
  })

  if (error) {
    console.error('[quiz/save-step] rpc error:', error)
    return NextResponse.json({ error: 'save_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
