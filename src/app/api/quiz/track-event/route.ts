import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const bodySchema = z.object({
  event: z.enum(['preview_viewed', 'offer_reached', 'tiers_reached', 'page_end']),
})

// Registra eventos de funil pós-quiz em draft_answers como chaves extras
// (ex: { _ev_preview_viewed: "2026-07-01T..." }).
// Usa a RPC track_funnel_event (migration 0020): merge atômico via jsonb ||
// direto no UPDATE. Antes fazia SELECT + merge em JS + UPDATE, o que perdia
// eventos quando dois disparavam próximos (ex: scroll rápido cruzando
// offer_reached e tiers_reached quase junto) — a escrita que chegava por
// último sobrescrevia a coluna inteira e apagava o evento da outra.
export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('nutriplan_session_id')?.value
  if (!sessionId) return NextResponse.json({ ok: false }, { status: 200 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ ok: false }) }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false })

  const key = `_ev_${parsed.data.event}`
  const supabase = createServiceClient()

  await supabase.rpc('track_funnel_event', { p_session_id: sessionId, p_key: key })

  return NextResponse.json({ ok: true })
}
