import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { sendFacebookInitiateCheckout } from '@/lib/fb-conversions-api'

const bodySchema = z.object({
  plan_type: z.enum(['basic', 'recipes', 'training']).optional().default('recipes'),
})

// Hotmart é o gateway para todos os mercados no MVP
const PROVIDER_BY_COUNTRY: Record<string, 'hotmart'> = {
  MX: 'hotmart',
  CO: 'hotmart',
  CL: 'hotmart',
  ES: 'hotmart',
}

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

  const { plan_type } = parsed.data
  const PRODUCT_CODE: Record<string, string> = {
    basic: 'PLAN_BASIC',
    recipes: 'PLAN_RECIPES',
    training: 'PLAN_TRAINING',
  }
  const productCode = PRODUCT_CODE[plan_type]
  const sessionId = request.cookies.get('nutriplan_session_id')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: session } = await supabase
    .from('generation_sessions')
    .select('id, country, lead_id')
    .eq('id', sessionId)
    .single()

  if (!session?.country) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
  }

  const FALLBACK_PRICES: Record<string, number> = {
    PLAN_BASIC: 9.90,
    PLAN_RECIPES: 3.90,
    PLAN_TRAINING: 14.90,
  }

  const { data: prices } = await supabase
    .from('price_book')
    .select('product_code, currency, local_price, period_version')
    .eq('country', session.country)
    .is('effective_to', null)
    .eq('product_code', productCode)
    .limit(1)

  const priceRow = prices?.[0]
  const plan = priceRow ?? {
    product_code: productCode,
    local_price: FALLBACK_PRICES[productCode] ?? 9.90,
    currency: 'USD',
    period_version: 1,
  }

  const provider = PROVIDER_BY_COUNTRY[session.country] ?? 'hotmart'
  const idempotencyKey = `${sessionId}-${plan_type}`
  const totalAmount = Number(plan.local_price)

  // Cookies do Meta Pixel + contexto do navegador, capturados aqui (antes do
  // redirect para a Hotmart) porque o webhook de pagamento é server-to-server
  // e não tem acesso a cookies. Usados depois para mandar o Purchase pela
  // Conversions API com bom match quality.
  const fbc = request.cookies.get('_fbc')?.value ?? null
  const fbp = request.cookies.get('_fbp')?.value ?? null
  const clientUserAgent = request.headers.get('user-agent') ?? null
  const clientIpAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  // Idempotent insert — on conflict (unique idempotency_key) return existing order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      session_id: sessionId,
      lead_id: session.lead_id ?? null,
      status: 'pending',
      country: session.country,
      currency: plan.currency,
      total_amount: totalAmount,
      provider,
      price_book_period_version: plan.period_version,
      idempotency_key: idempotencyKey,
      fbc,
      fbp,
      client_user_agent: clientUserAgent,
      client_ip_address: clientIpAddress,
    })
    .select('id')
    .single()

  if (orderError) {
    if (orderError.code === '23505') {
      // Already exists — return existing order id
      const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .single()
      if (existing) {
        // Cura pedidos que ficaram sem item (insert de items falhou na 1ª tentativa)
        await supabase.from('order_items').upsert(
          {
            order_id: existing.id,
            kind: 'nutrition',
            product_code: productCode,
            unit_price: Number(plan.local_price),
            currency: plan.currency ?? 'USD',
          },
          { onConflict: 'order_id,product_code', ignoreDuplicates: true },
        )
        return NextResponse.json({
          order_id: existing.id,
          idempotency_key: idempotencyKey,
          provider,
          price: { amount: Number(plan.local_price), currency: plan.currency },
        })
      }
    }
    console.error('[create-order] insert error:', orderError)
    return NextResponse.json({ error: 'order_creation_failed' }, { status: 500 })
  }

  // Um único item por pedido: uq_order_item_product impede repetir o
  // product_code no mesmo order. O tier training é detectado pelo próprio
  // product_code (PLAN_TRAINING) no process-order — não precisa de item extra.
  const items = [
    {
      order_id: order.id,
      kind: 'nutrition' as const,
      product_code: productCode,
      unit_price: Number(plan.local_price),
      currency: plan.currency ?? 'USD',
    },
  ]

  const { error: itemsError } = await supabase.from('order_items').insert(items)
  if (itemsError) {
    console.error('[create-order] items insert error:', itemsError)
    return NextResponse.json({ error: 'items_creation_failed' }, { status: 500 })
  }

  // Dispara InitiateCheckout via CAPI server-side (não depende do pixel do navegador).
  // event_id compartilhado com o pixel client-side para que o Meta desduplique.
  void sendFacebookInitiateCheckout({
    orderId: order.id,
    value: totalAmount,
    currency: plan.currency ?? 'USD',
    fbc,
    fbp,
    clientIpAddress,
    clientUserAgent,
    sessionId,
  })

  return NextResponse.json({
    order_id: order.id,
    idempotency_key: idempotencyKey,
    provider,
    price: { amount: Number(plan.local_price), currency: plan.currency },
  })
}
