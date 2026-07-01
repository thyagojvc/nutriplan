import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const bodySchema = z.object({
  event: z.enum(['preview_viewed']),
})

// Registra eventos de funil pós-quiz em draft_answers como chaves extras
// (ex: { _ev_preview_viewed: "2026-07-01T..." }).
// Sem migration: reutiliza o JSONB existente de generation_sessions.
export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('nutriplan_session_id')?.value
  if (!sessionId) return NextResponse.json({ ok: false }, { status: 200 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ ok: false }) }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false })

  const key = `_ev_${parsed.data.event}`
  const supabase = createServiceClient()

  const { data: row } = await supabase
    .from('generation_sessions')
    .select('draft_answers')
    .eq('id', sessionId)
    .single()

  if (!row) return NextResponse.json({ ok: true })

  const merged = {
    ...(typeof row.draft_answers === 'object' && row.draft_answers !== null ? row.draft_answers : {}),
    [key]: new Date().toISOString(),
  }

  await supabase
    .from('generation_sessions')
    .update({ draft_answers: merged })
    .eq('id', sessionId)

  return NextResponse.json({ ok: true })
}
