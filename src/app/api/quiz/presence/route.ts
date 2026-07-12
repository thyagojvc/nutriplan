import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const bodySchema = z.object({ step: z.number().int().min(1).max(20) })

// Heartbeat de presença "ao vivo": o quiz chama isto a cada poucos segundos com
// a etapa VISÍVEL atual (displayStep). Grava _live_<etapa> = now() em
// draft_answers via a RPC atômica track_funnel_event (migration 0020), mesmo
// merge jsonb || usado pelos eventos _ev_*. Sem migration nova. A presença
// "expira" sozinha: quem lê (live-presence) só considera timestamps recentes,
// então quando a pessoa fecha a aba e os beats param, ela some da visão ao vivo.
export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('nutriplan_session_id')?.value
  if (!sessionId) return NextResponse.json({ ok: false }, { status: 200 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ ok: false }) }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false })

  const supabase = createServiceClient()
  await supabase.rpc('track_funnel_event', {
    p_session_id: sessionId,
    p_key: `_live_${parsed.data.step}`,
  })

  return NextResponse.json({ ok: true })
}
