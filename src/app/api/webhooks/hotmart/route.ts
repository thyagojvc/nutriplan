import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processPaidOrder } from '@/lib/nutrition/process-order'
import { sendPlanReadyEmail, sendCheckinReminderEmail } from '@/lib/email'
import { sendFacebookPurchase } from '@/lib/fb-conversions-api'
import type { PhaseNumber } from '@/lib/nutrition/generate'

// ID do produto order bump na Hotmart
const HOTMART_TRAINING_PRODUCT_ID = '7973770'

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
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[webhook/hotmart] handler error:', msg)

    // Erros de "ainda não existe" → 500 para a Hotmart retentar automaticamente
    if (msg === 'training_bump_user_not_found_yet' || msg === 'training_bump_order_not_found') {
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    // Demais erros: 200 para evitar loop de reenvios infinitos (logado acima)
  }

  return NextResponse.json({ ok: true })
}

async function handlePurchaseApproved(data: Record<string, unknown>) {
  const buyer = data.buyer as Record<string, unknown> | undefined
  const purchase = data.purchase as Record<string, unknown> | undefined
  const product = data.product as Record<string, unknown> | undefined

  const email = buyer?.email as string | undefined
  const name = (buyer?.name as string | undefined) ?? ''
  const transactionId = purchase?.transaction as string | undefined
  const recurrenceNumber = (purchase?.recurrence_number as number | undefined) ?? 0
  const productId = String(product?.id ?? '')

  if (!email) return

  // Webhook separado para o order bump de treino (produto 7973770)
  if (productId === HOTMART_TRAINING_PRODUCT_ID) {
    await handleTrainingBumpApproved({ email, name })
    return
  }

  // Verificar se o payload da Hotmart inclui o bump em order_items (fallback)
  const payloadItems = (purchase?.order_items as Array<Record<string, unknown>> | undefined) ?? []
  const hasBumpInPayload = payloadItems.some(
    (item) => String(item.product_id ?? '') === HOTMART_TRAINING_PRODUCT_ID,
  )

  if (recurrenceNumber === 0) {
    const orderResult = await activateNewSubscriber({ email, name, transactionId })
    if (orderResult) {
      const { orderId, totalAmount, currency, fbc, fbp, clientIpAddress, clientUserAgent } = orderResult

      // Bump detectado no payload mas não pré-selecionado no checkout: adicionar item
      if (hasBumpInPayload) {
        await ensureTrainingItem(orderId)
      }

      // Dispara a geração do plano logo após marcar o pedido pago.
      const result = await processPaidOrder(orderId)
      console.info('[webhook/hotmart] generation', result)

      // Conversions API — Purchase (não bloqueia; não lança se falhar)
      sendFacebookPurchase({
        email,
        transactionId,
        value: totalAmount,
        currency: currency ?? 'USD',
        fbc,
        fbp,
        clientIpAddress,
        clientUserAgent,
      }).catch(err => console.error('[webhook/hotmart] fb-capi falhou (não bloqueante):', err))

      // E-mail pós-geração (não bloqueia a resposta ao Hotmart se falhar)
      try {
        await sendMagicLinkEmail(email, name)
      } catch (emailErr) {
        console.error('[webhook/hotmart] email falhou (não bloqueante):', emailErr)
      }
    }
  } else {
    // Renovação: cria novo order, check-in pendente e envia email de check-in
    await handleRenewal({ email, name, transactionId, recurrenceNumber })
  }
}

interface ActivateResult {
  orderId: string
  totalAmount: number
  currency: string
  fbc?: string | null
  fbp?: string | null
  clientIpAddress?: string | null
  clientUserAgent?: string | null
}

async function activateNewSubscriber({
  email,
  name,
  transactionId,
}: {
  email: string
  name: string
  transactionId?: string
}): Promise<ActivateResult | null> {
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
  if (!sessionId) {
    // Email não tem quiz preenchido (ex: payload de teste da Hotmart). Ignorar.
    console.warn('[webhook/hotmart] activateNewSubscriber: sem sessão para', email)
    return null
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, total_amount, currency, fbc, fbp, client_ip_address, client_user_agent')
    .eq('session_id', sessionId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

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

  if (!order?.id) return null

  return {
    orderId: order.id,
    totalAmount: Number(order.total_amount ?? 0),
    currency: order.currency ?? 'USD',
    fbc: order.fbc,
    fbp: order.fbp,
    clientIpAddress: order.client_ip_address,
    clientUserAgent: order.client_user_agent,
  }
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

async function handleRenewal({
  email,
  name,
  transactionId,
  recurrenceNumber,
}: {
  email: string
  name: string
  transactionId?: string
  recurrenceNumber: number
}) {
  const supabase = createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nutriplan-tzyt.vercel.app'

  // 1. Encontrar o usuário pelo email
  const { data: user } = await supabase
    .from('users')
    .select('id, name, country')
    .eq('email', email)
    .maybeSingle()

  if (!user) {
    console.error('[webhook/hotmart] renewal: usuário não encontrado para', email)
    return
  }

  // 2. Encontrar o order mais recente (para copiar session_id, items e calcular ciclo)
  const { data: latestOrder } = await supabase
    .from('orders')
    .select('id, session_id, subscription_cycle')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestOrder) {
    console.error('[webhook/hotmart] renewal: nenhum order anterior para', email)
    return
  }

  const newCycle = (latestOrder.subscription_cycle ?? 1) + 1
  // Fase cap: 3 = consolidação/manutenção indefinida
  const phaseNumber = Math.min(newCycle, 3) as PhaseNumber

  // 3. Criar novo order já como "paid" (não passa por pending no checkout)
  const { data: items } = await supabase
    .from('order_items')
    .select('kind, product_code, unit_price, currency')
    .eq('order_id', latestOrder.id)

  const { data: newOrder, error: orderErr } = await supabase
    .from('orders')
    .insert({
      user_id: user.id,
      session_id: latestOrder.session_id,
      status: 'paid',
      country: user.country ?? 'OTHER',
      currency: 'USD',
      total_amount: 0, // Hotmart gerencia o valor; não precisamos armazená-lo aqui
      provider: 'hotmart',
      provider_payment_id: transactionId ?? null,
      subscription_cycle: newCycle,
      paid_at: new Date().toISOString(),
      price_book_period_version: new Date().toISOString().slice(0, 7), // 'YYYY-MM'
    })
    .select('id')
    .single()

  if (orderErr || !newOrder) {
    console.error('[webhook/hotmart] renewal: falha ao criar order', orderErr)
    return
  }

  // 4. Copiar os items do order anterior para o novo
  if (items && items.length > 0) {
    await supabase.from('order_items').insert(
      items.map((it) => ({
        order_id: newOrder.id,
        kind: it.kind,
        product_code: it.product_code,
        unit_price: it.unit_price,
        currency: it.currency,
      })),
    )
  }

  // 5. Criar check-in pendente com token único
  const token = crypto.randomUUID()
  const { error: checkinErr } = await supabase.from('user_checkins').insert({
    user_id: user.id,
    order_id: newOrder.id,
    cycle_number: phaseNumber,
    token,
  })

  if (checkinErr) {
    // Se o unique index (user_id, cycle_number) já existe, seguir sem check-in
    console.warn('[webhook/hotmart] renewal: check-in já existe ou falhou', checkinErr.message)
  }

  // 6. Enviar email de check-in (se Resend configurado)
  if (process.env.RESEND_API_KEY) {
    const checkinUrl = `${appUrl}/checkin?token=${token}`
    try {
      await sendCheckinReminderEmail({
        to: email,
        name: name || user.name || '',
        checkinUrl,
        phaseNumber,
      })
    } catch (emailErr) {
      console.error('[webhook/hotmart] renewal: email falhou (não bloqueante):', emailErr)
    }
  }

  console.info('[webhook/hotmart] renewal processado', {
    email,
    newCycle,
    phaseNumber,
    orderId: newOrder.id,
  })
}

/**
 * Webhook separado da Hotmart para o order bump de treino.
 * Encontra o order mais recente do comprador, garante o item de treino
 * e re-dispara a geração se o plano nutricional já estiver entregue.
 */
async function handleTrainingBumpApproved({ email, name }: { email: string; name: string }) {
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!user) {
    // Webhook do bump chegou antes do produto principal — Hotmart vai retentar no 500
    console.warn('[webhook/hotmart] training bump: usuário ainda não existe para', email)
    throw new Error('training_bump_user_not_found_yet')
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, status')
    .eq('user_id', user.id)
    .in('status', ['paid', 'generating', 'delivered'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!order) {
    console.warn('[webhook/hotmart] training bump: nenhum order ativo para', email)
    throw new Error('training_bump_order_not_found')
  }

  await ensureTrainingItem(order.id)

  // Se o plano já foi entregue (sem treino): resetar para paid e re-gerar
  if (order.status === 'delivered') {
    const { data: reset } = await supabase
      .from('orders')
      .update({ status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('status', 'delivered')
      .select('id')
      .maybeSingle()

    if (reset) {
      const result = await processPaidOrder(order.id)
      console.info('[webhook/hotmart] training bump re-generation', result)
      try {
        await sendMagicLinkEmail(email, name)
      } catch (emailErr) {
        console.error('[webhook/hotmart] training bump email falhou (não bloqueante):', emailErr)
      }
    }
  }
  // Se paid ou generating: processPaidOrder em andamento detectará o item de treino
}

/**
 * Insere o item TRAINING_BUMP no order, idempotente.
 * Usa upsert com ignoreDuplicates para não quebrar se o item já existir
 * (ex: usuário pré-selecionou o bump em nossa página e Hotmart mandou webhook separado).
 */
async function ensureTrainingItem(orderId: string) {
  const supabase = createServiceClient()

  const { data: order } = await supabase
    .from('orders')
    .select('country, currency')
    .eq('id', orderId)
    .single()

  const { data: price } = order
    ? await supabase
        .from('price_book')
        .select('local_price, currency')
        .eq('country', order.country)
        .eq('product_code', 'TRAINING_BUMP')
        .is('effective_to', null)
        .maybeSingle()
    : { data: null }

  const { error } = await supabase.from('order_items').upsert(
    {
      order_id: orderId,
      kind: 'training',
      product_code: 'TRAINING_BUMP',
      unit_price: Number(price?.local_price ?? 4.90),
      currency: price?.currency ?? order?.currency ?? 'USD',
    },
    { onConflict: 'order_id,product_code', ignoreDuplicates: true },
  )

  if (error) {
    console.error('[webhook/hotmart] ensureTrainingItem error:', error.message)
  }
}

async function handleDeactivate(
  data: Record<string, unknown>,
  reason: 'refunded' | 'cancelled',
) {
  const buyer = data.buyer as Record<string, unknown> | undefined
  const email = buyer?.email as string | undefined
  if (!email) return

  console.info('[webhook/hotmart] deactivate', { email, reason })

  // Cancelamento de assinatura não revoga acesso imediato (período já pago ainda vale)
  if (reason !== 'refunded') return

  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('auth_user_id')
    .eq('email', email)
    .maybeSingle()

  if (!user?.auth_user_id) {
    console.warn('[webhook/hotmart] deactivate: usuário não encontrado para', email)
    return
  }

  const { error } = await supabase.auth.admin.updateUserById(user.auth_user_id, {
    ban_duration: '876600h',
  })

  if (error) {
    console.error('[webhook/hotmart] deactivate: falha ao revogar acesso', { email, error })
  } else {
    console.info('[webhook/hotmart] deactivate: acesso revogado', { email })
  }
}
