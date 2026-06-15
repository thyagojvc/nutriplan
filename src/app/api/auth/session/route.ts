import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const bodySchema = z.object({
  order_id: z.string().uuid(),
  idempotency_key: z.string().min(1),
})

export async function POST(request: NextRequest) {
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

  const { order_id, idempotency_key } = parsed.data
  const supabase = createServiceClient()

  // Query 1: buscar pedido e validar status
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, user_id')
    .eq('id', order_id)
    .eq('idempotency_key', idempotency_key)
    .single()

  if (orderError || !order) {
    console.error('[auth/session] order not found:', { order_id, orderError })
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 })
  }

  if (order.status === 'pending') {
    return NextResponse.json({ status: 'pending' }, { status: 202 })
  }

  if (!['paid', 'generating', 'needs_review', 'delivered'].includes(order.status)) {
    return NextResponse.json({ error: 'order_not_payable' }, { status: 422 })
  }

  if (!order.user_id) {
    return NextResponse.json({ error: 'user_not_linked' }, { status: 404 })
  }

  // Query 2: buscar e-mail na tabela pública users
  // Não usamos auth.admin.getUserById porque o e-mail já está em users.email
  const { data: publicUser, error: userError } = await supabase
    .from('users')
    .select('email')
    .eq('id', order.user_id)
    .single()

  if (userError || !publicUser?.email) {
    console.error('[auth/session] user not found:', { user_id: order.user_id, userError })
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
  }

  // Gerar magic link — token_hash para fluxo implícito (não action_link, falha com PKCE)
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: publicUser.email,
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('[auth/session] generateLink error:', { email: publicUser.email, linkError })
    return NextResponse.json({ error: 'link_generation_failed' }, { status: 500 })
  }

  return NextResponse.json({ hashed_token: linkData.properties.hashed_token })
}
