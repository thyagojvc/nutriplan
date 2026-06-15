import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const bodySchema = z.object({ include_bump: z.boolean() })

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

  const { include_bump } = parsed.data
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

  const { data: prices } = await supabase
    .from('price_book')
    .select('product_code, currency, local_price, period_version')
    .eq('country', session.country)
    .is('effective_to', null)
    .in('product_code', ['PLAN_STANDARD', 'TRAINING_BUMP'])

  const plan = prices?.find(p => p.product_code === 'PLAN_STANDARD')
  const bump = prices?.find(p => p.product_code === 'TRAINING_BUMP')

  if (!plan) {
    return NextResponse.json({ error: 'prices_not_found' }, { status: 404 })
  }

  const provider = PROVIDER_BY_COUNTRY[session.country] ?? 'hotmart'
  const products = include_bump ? 'plan+bump' : 'plan'
  const idempotencyKey = `${sessionId}-${products}`
  const totalAmount =
    include_bump && bump
      ? Number(plan.local_price) + Number(bump.local_price)
      : Number(plan.local_price)

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
        return NextResponse.json({ order_id: existing.id, idempotency_key: idempotencyKey, provider })
      }
    }
    console.error('[create-order] insert error:', orderError)
    return NextResponse.json({ error: 'order_creation_failed' }, { status: 500 })
  }

  const items: {
    order_id: string
    kind: 'nutrition' | 'training'
    product_code: string
    unit_price: number
    currency: string
  }[] = [
    {
      order_id: order.id,
      kind: 'nutrition',
      product_code: 'PLAN_STANDARD',
      unit_price: Number(plan.local_price),
      currency: plan.currency,
    },
  ]

  if (include_bump && bump) {
    items.push({
      order_id: order.id,
      kind: 'training',
      product_code: 'TRAINING_BUMP',
      unit_price: Number(bump.local_price),
      currency: plan.currency,
    })
  }

  const { error: itemsError } = await supabase.from('order_items').insert(items)
  if (itemsError) {
    console.error('[create-order] items insert error:', itemsError)
    return NextResponse.json({ error: 'items_creation_failed' }, { status: 500 })
  }

  return NextResponse.json({ order_id: order.id, idempotency_key: idempotencyKey, provider })
}
