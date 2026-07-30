import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Apaga uma sessão de quiz (lead falso/teste) direto do painel /quiz-funnel.
// orders.session_id é "on delete set null", então pedidos reais associados
// não são afetados, só perdem o vínculo com essa sessão.
// Protegida por ADMIN_SECRET (mesma env var de /api/admin/resend-link).
export async function POST(request: NextRequest) {
  const { sessionId, secret } = await request.json()

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId obrigatório' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('generation_sessions').delete().eq('id', sessionId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
