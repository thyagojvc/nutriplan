import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processPaidOrder } from '@/lib/nutrition/process-order'
import { sendPlanReadyEmail } from '@/lib/email'

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
    const orderId = await activateNewSubscriber({ email, name, transactionId })
    // Dispara a geração do plano logo após marcar o pedido pago.
    // O stub é instantâneo; quando a IA entrar (10–30 s), mover para fila/background
    // para não estourar o timeout do webhook do Hotmart.
    if (orderId) {
      const result = await processPaidOrder(orderId)
      console.info('[webhook/hotmart] generation', result)

      // E-mail pós-geração (não bloqueia a resposta ao Hotmart se falhar)
      try {
        await sendMagicLinkEmail(email, name)
      } catch (emailErr) {
        console.error('[webhook/hotmart] email falhou (não bloqueante):', emailErr)
      }
    }
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
}): Promise<string | null> {
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
      return null
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
      return null
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

  return order?.id ?? null
}

async function sendMagicLinkEmail(email: string, name: string) {
  if (!process.env.RESEND_API_KEY) return

  const supabase = createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nutriplan-tzyt.vercel.app'

  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: appUrl + '/dashboard' },
  })

  const magicLink = linkData?.properties?.action_link
  if (!magicLink) {
    console.error('[webhook/hotmart] generateLink não retornou action_link')
    return
  }

  await sendPlanReadyEmail({ to: email, name, magicLink })
  console.info('[webhook/hotmart] e-mail enviado para', email)
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
