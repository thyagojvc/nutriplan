import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processPaidOrder } from '@/lib/nutrition/process-order'

// Disparo manual de geração para um pedido já pago.
// Usos: (1) testar pedidos pagos antes da Fase C existir; (2) reprocessar
// pedidos em needs_review. Protegido por token (mesmo segredo do webhook).
//
// POST /api/admin/generate?token=<HOTMART_HOTTOK>
//   body: { order_id?: string, email?: string }
//   - order_id: dispara direto nesse pedido
//   - email: busca o pedido pago/needs_review mais recente desse e-mail
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token || token !== process.env.HOTMART_HOTTOK) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { order_id?: string; email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const supabase = createServiceClient()
  let orderId = body.order_id

  // Resolver order_id por e-mail se não veio explícito
  if (!orderId && body.email) {
    const { data: order } = await supabase
      .from('orders')
      .select('id, status')
      .eq('status', 'paid')
      .in('id', await orderIdsForEmail(body.email))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    orderId = order?.id
  }

  if (!orderId) {
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 })
  }

  // Se estiver em needs_review, recolocar em paid para o claim atômico funcionar
  await supabase
    .from('orders')
    .update({ status: 'paid' })
    .eq('id', orderId)
    .eq('status', 'needs_review')

  const result = await processPaidOrder(orderId)
  return NextResponse.json(result)
}

async function orderIdsForEmail(email: string): Promise<string[]> {
  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (!user) return ['00000000-0000-0000-0000-000000000000']
  const { data: orders } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', user.id)
  return (orders ?? []).map((o) => o.id)
}
