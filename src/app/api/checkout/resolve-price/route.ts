import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
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

  return NextResponse.json({
    country: session.country,
    currency: plan.currency,
    plan: {
      product_code: plan.product_code,
      local_price: Number(plan.local_price),
      period_version: plan.period_version,
    },
    bump: bump
      ? {
          product_code: bump.product_code,
          local_price: Number(bump.local_price),
          period_version: bump.period_version,
        }
      : null,
  })
}
