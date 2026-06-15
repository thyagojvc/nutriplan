import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  // Hotmart v2.0.0 envia o hottok como query param: ?hottok=xxx
  const receivedHottok = request.nextUrl.searchParams.get('hottok')
  if (!receivedHottok || receivedHottok !== process.env.HOTMART_HOTTOK) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const event = body.event as string
  const data = body.data as Record<string, unknown>

  try {
    if (event === 'PURCHASE_APPROVED') {
      await handlePurchaseApproved(data)
    } else if (event === 'PURCHASE_REFUNDED') {
      await handleDeactivate(data, 'refunded')
    } else if (event === 'SUBSCRIPTION_CANCELLATION') {
      await handleDeactivate(data, 'cancelled')
    }
  } catch (err) {
    console.error('[webhook/hotmart] handler error:', err)
    // Retorna 200 mesmo em erro interno para evitar reenvios infinitos do Hotmart
    // O erro fica logado para investigação manual
  }

  return NextResponse.json({ ok: true })
}

async function handlePurchaseApproved(data: Record<string, unknown>) {
  const buyer = data.buyer as Record<string, unknown> | undefined
  const purchase = data.purchase as Record<string, unknown> | undefined

  const email = buyer?.email as string | undefined
  const name = (buyer?.name as string | undefined) ?? ''
  const transactionId = purchase?.transaction as string | undefined
  const recurrenceNumber = (purchase?.recurrence_number as number | undefined) ?? 0

  if (!email) return

  if (recurrenceNumber === 0) {
    await activateNewSubscriber({ email, name, transactionId })
  } else {
    // Renovação — usuário já existe; futuramente disparar geração de novo plano
    console.info('[webhook/hotmart] renewal received', { email, recurrenceNumber })
  }
}

async function activateNewSubscriber({
  email,
  name,
  transactionId,
}: {
  email: string
  name: string
  transactionId?: string
}) {
  const supabase = createServiceClient()

  // 1. Encontrar lead mais recente pelo e-mail
  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, country, session_id:generation_sessions(id)')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // lead.session_id pode ser gerado da relação inversa — buscar direto na session
  const { data: session } = await supabase
    .from('generation_sessions')
    .select('id, country')
    .eq('lead_id', lead?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 2. Encontrar pedido pendente para esta sessão
  const sessionId = session?.id
  const { data: order } = sessionId
    ? await supabase
        .from('orders')
        .select('id, status')
        .eq('session_id', sessionId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  // 3. Verificar se usuário já existe
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  let userId: string

  if (existingUser) {
    userId = existingUser.id
  } else {
    // Criar usuário no Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    })

    if (authError || !authData?.user) {
      console.error('[webhook/hotmart] createUser error:', authError)
      return
    }

    // Inserir em public.users
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email,
        name: name || lead?.name || '',
        auth_user_id: authData.user.id,
        country: session?.country ?? lead?.country ?? 'MX',
      })
      .select('id')
      .single()

    if (userError || !newUser) {
      console.error('[webhook/hotmart] user insert error:', userError)
      return
    }

    userId = newUser.id
  }

  // 4. Marcar pedido como pago
  if (order?.id) {
    await supabase
      .from('orders')
      .update({
        status: 'paid',
        user_id: userId,
        paid_at: new Date().toISOString(),
        provider_payment_id: transactionId ?? null,
      })
      .eq('id', order.id)
  }

  // 5. Vincular usuário à sessão e lead
  if (sessionId) {
    await supabase
      .from('generation_sessions')
      .update({ user_id: userId })
      .eq('id', sessionId)
  }

  if (lead?.id) {
    await supabase
      .from('leads')
      .update({ converted: true, user_id: userId })
      .eq('id', lead.id)
  }

  // TODO Fase D: enviar e-mail de magic link via Resend
}

async function handleDeactivate(
  data: Record<string, unknown>,
  _reason: 'refunded' | 'cancelled',
) {
  const buyer = data.buyer as Record<string, unknown> | undefined
  const email = buyer?.email as string | undefined
  if (!email) return

  // Por ora apenas logamos — suspensão de conta será implementada na Fase D
  console.info('[webhook/hotmart] deactivate', { email, _reason })
}
