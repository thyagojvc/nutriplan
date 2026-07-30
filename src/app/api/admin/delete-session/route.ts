import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Apaga uma ou várias sessões de quiz (leads falsos/de teste) direto do painel
// /quiz-funnel, com seleção múltipla via checkbox. orders.session_id é
// "on delete set null", então pedidos reais associados não são afetados, só
// perdem o vínculo com essa sessão.
// Protegida por ADMIN_SECRET (mesma env var de /api/admin/resend-link).
export async function POST(request: NextRequest) {
  const body = await request.json()
  const secret = body.secret
  const sessionIds: string[] = Array.isArray(body.sessionIds)
    ? body.sessionIds
    : body.sessionId
    ? [body.sessionId]
    : []

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (sessionIds.length === 0) {
    return NextResponse.json({ error: 'sessionIds obrigatório' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('generation_sessions').delete().in('id', sessionIds)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted: sessionIds.length })
}
