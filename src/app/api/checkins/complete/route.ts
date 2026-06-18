import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processPaidOrder } from '@/lib/nutrition/process-order'

export async function POST(request: NextRequest) {
  let body: { token: string; currentWeightKg?: number; adherenceRating?: number; notes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { token, currentWeightKg, adherenceRating, notes } = body
  if (!token) {
    return NextResponse.json({ error: 'token_required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 1. Validar token e verificar que ainda não foi completado
  const { data: checkin } = await supabase
    .from('user_checkins')
    .select('id, user_id, order_id, cycle_number, completed_at')
    .eq('token', token)
    .maybeSingle()

  if (!checkin) {
    return NextResponse.json({ error: 'token_invalid' }, { status: 404 })
  }
  if (checkin.completed_at) {
    return NextResponse.json({ error: 'already_completed' }, { status: 409 })
  }

  // 2. Salvar dados do check-in e marcar como completado
  const { error: updateErr } = await supabase
    .from('user_checkins')
    .update({
      current_weight_kg: currentWeightKg ?? null,
      adherence_rating: adherenceRating ?? null,
      notes: notes ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', checkin.id)

  if (updateErr) {
    console.error('[checkins/complete] update error:', updateErr)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  // 3. Disparar geração do plano (o order já está com status='paid')
  const result = await processPaidOrder(checkin.order_id)
  console.info('[checkins/complete] geração:', result)

  if (!result.ok && result.status === 'needs_review') {
    // Geração falhou mas foi para revisão manual — informar sem expor detalhe
    return NextResponse.json({ ok: true, status: 'pending_review' })
  }

  return NextResponse.json({ ok: true, status: 'delivered' })
}

// GET: valida o token e retorna dados básicos para pré-preencher a página
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'token_required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: checkin } = await supabase
    .from('user_checkins')
    .select('cycle_number, completed_at, users(name)')
    .eq('token', token)
    .maybeSingle()

  if (!checkin) {
    return NextResponse.json({ error: 'token_invalid' }, { status: 404 })
  }

  return NextResponse.json({
    cycleNumber: checkin.cycle_number,
    alreadyCompleted: !!checkin.completed_at,
    name: (checkin.users as { name?: string } | null)?.name ?? '',
  })
}
