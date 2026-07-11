import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { processPaidOrder } from '@/lib/nutrition/process-order'
import { sendPlanReadyEmail } from '@/lib/email'

const bodySchema = z.object({ order_id: z.string().uuid() })

// Dev-only: simulates webhook flow (mark order paid + create user)
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not_available' }, { status: 404 })
  }

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

  const { order_id } = parsed.data
  const supabase = createServiceClient()

  const { data: order } = await supabase
    .from('orders')
    .select('id, session_id, lead_id, status')
    .eq('id', order_id)
    .single()

  if (!order) return NextResponse.json({ error: 'order_not_found' }, { status: 404 })
  if (order.status !== 'pending') return NextResponse.json({ ok: true }) // idempotent

  const leadId = order.lead_id ?? (await (async () => {
    if (!order.session_id) return null
    const { data: s } = await supabase.from('generation_sessions').select('lead_id').eq('id', order.session_id).single()
    return s?.lead_id ?? null
  })())

  if (!leadId) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 })

  const { data: lead } = await supabase
    .from('leads')
    .select('email, name, country')
    .eq('id', leadId)
    .single()

  if (!lead) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 })

  // Check if public user already exists (from prior test run)
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', lead.email)
    .single()

  let userId: string

  if (existingUser) {
    userId = existingUser.id
  } else {
    // Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: lead.email,
      email_confirm: true,
    })

    if (authError || !authUser?.user) {
      console.error('[simulate-payment] createUser error:', authError)
      return NextResponse.json({ error: 'auth_creation_failed' }, { status: 500 })
    }

    // Insert into public.users
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email: lead.email,
        name: lead.name,
        auth_user_id: authUser.user.id,
        country: lead.country,
      })
      .select('id')
      .single()

    if (userError || !newUser) {
      console.error('[simulate-payment] user insert error:', userError)
      return NextResponse.json({ error: 'user_insert_failed' }, { status: 500 })
    }

    userId = newUser.id
  }

  // Mark order as paid and link user
  await supabase
    .from('orders')
    .update({ status: 'paid', user_id: userId, paid_at: new Date().toISOString() })
    .eq('id', order_id)

  // Link user to generation_session
  if (order.session_id) {
    await supabase
      .from('generation_sessions')
      .update({ user_id: userId })
      .eq('id', order.session_id)
  }

  // Dispara a geração do plano (mesmo caminho da produção)
  const generation = await processPaidOrder(order_id)

  // E-mail de aviso (igual ao webhook real; só funciona se RESEND_API_KEY estiver no .env.local)
  if (process.env.RESEND_API_KEY) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: lead.email,
        options: { redirectTo: appUrl + '/auth/callback' },
      })
      const magicLink = linkData?.properties?.action_link
      if (magicLink) {
        await sendPlanReadyEmail({ to: lead.email, name: lead.name ?? '', magicLink })
        console.info('[simulate-payment] e-mail enviado para', lead.email)
      }
    } catch (emailErr) {
      console.error('[simulate-payment] email falhou (não bloqueante):', emailErr)
    }
  }

  return NextResponse.json({ ok: true, generation })
}
