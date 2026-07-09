import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processPaidOrder } from '@/lib/nutrition/process-order'
import { sendPlanReadyEmail, sendCheckinReminderEmail } from '@/lib/email'
import { sendFacebookPurchase } from '@/lib/fb-conversions-api'
import type { PhaseNumber } from '@/lib/nutrition/generate'

// IDs dos 3 produtos na Hotmart. PLAN_BASIC é o produto principal da sales page;
// PLAN_RECIPES e PLAN_TRAINING agora são order bumps do checkout do PLAN_BASIC
// (mesmo produto Hotmart de antes, só renomeado/reprecificado no painel deles).
const HOTMART_PRODUCT_IDS: Record<string, string> = {
  '7968007': 'PLAN_BASIC',
  '7998986': 'PLAN_RECIPES',
  '7973770': 'PLAN_TRAINING',
}

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

    // Nenhum erro temporário esperado no modelo de 3 tiers separados
    // Demais erros: 200 para evitar loop de reenvios infinitos (logado acima)
  }

  return NextResponse.json({ ok: true })
}

// Extrai os dados de Advanced Matching que a Hotmart já coleta no checkout
// (nome, telefone, endereço, documento), pra melhorar a qualidade de
// correspondência do evento Purchase no Meta sem pedir nada a mais ao comprador.
function extractAdvancedMatching(buyer: Record<string, unknown> | undefined, fullName: string) {
  const address = buyer?.address as Record<string, unknown> | undefined

  let firstName = buyer?.first_name as string | undefined
  let lastName = buyer?.last_name as string | undefined
  if (!firstName && fullName) {
    const parts = fullName.trim().split(/\s+/)
    firstName = parts[0]
    lastName = parts.slice(1).join(' ') || undefined
  }

  const phoneCode = (buyer?.checkout_phone_code as string | undefined) ?? ''
  const phoneNumber = (buyer?.checkout_phone as string | undefined) ?? ''
  const phoneDigits = `${phoneCode}${phoneNumber}`.replace(/\D/g, '')

  return {
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    phone: phoneDigits || undefined,
    city: (address?.city as string | undefined) || undefined,
    state: (address?.state as string | undefined) || undefined,
    zip: (address?.zipcode as string | undefined) || undefined,
    externalId: (buyer?.document as string | undefined) || undefined,
  }
}

async function handlePurchaseApproved(data: Record<string, unknown>) {
  const buyer = data.buyer as Record<string, unknown> | undefined
  const purchase = data.purchase as Record<string, unknown> | undefined
  const product = data.product as Record<string, unknown> | undefined

  const email = buyer?.email as string | undefined
  const name = (buyer?.name as string | undefined) ?? ''
  const transactionId = purchase?.transaction as string | undefined
  const advancedMatching = extractAdvancedMatching(buyer, name)
  const recurrenceNumber = (purchase?.recurrence_number as number | undefined) ?? 0
  const productId = String(product?.id ?? '')
  const productCode = HOTMART_PRODUCT_IDS[productId]

  if (!email) return

  // sck da URL de checkout (setado na preview) carrega o order_id do pedido
  // pendente. É o caminho primário de match — o quiz não captura mais e-mail,
  // então o lookup por lead/email virou apenas fallback de compatibilidade.
  const origin = purchase?.origin as Record<string, unknown> | undefined
  const sckRaw = origin?.sck ?? purchase?.sckPaymentLink ?? ''
  const orderIdHint =
    typeof sckRaw === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sckRaw)
      ? sckRaw
      : undefined

  console.info('[webhook/hotmart] produto recebido:', productId, productCode ?? 'desconhecido', 'sck:', orderIdHint ?? 'ausente')

  // Hotmart dispara um PURCHASE_APPROVED separado para cada order bump
  // marcado no checkout, além do produto principal. Recetas e Entrenamiento
  // hoje só existem como bump, então tratam de um jeito diferente do PLAN_BASIC.
  if (productCode === 'PLAN_RECIPES' || productCode === 'PLAN_TRAINING') {
    const price = purchase?.price as Record<string, unknown> | undefined
    await handleOrderBump({
      productCode,
      orderIdHint,
      unitPrice: Number(price?.value ?? 0),
      currency: (price?.currency_value as string | undefined) ?? 'USD',
    })
    return
  }

  if (recurrenceNumber === 0) {
    const orderResult = await activateNewSubscriber({ email, name, transactionId, orderIdHint })
    if (orderResult) {
      const { orderId, totalAmount, currency, fbc, fbp, clientIpAddress, clientUserAgent } = orderResult

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
        ...advancedMatching,
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

// Order bump (Recetas/Entrenamiento): identifica o pedido pelo sck do checkout
// (o mesmo carrinho do produto principal) e grava o item, sem depender de
// email/lead — o bump pode chegar antes, depois ou junto do webhook principal.
async function handleOrderBump({
  productCode,
  orderIdHint,
  unitPrice,
  currency,
}: {
  productCode: 'PLAN_RECIPES' | 'PLAN_TRAINING'
  orderIdHint?: string
  unitPrice: number
  currency: string
}) {
  if (!orderIdHint) {
    console.warn('[webhook/hotmart] bump sem sck válido, não foi possível asociar ao pedido:', productCode)
    return
  }

  const supabase = createServiceClient()
  const { data: order } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', orderIdHint)
    .maybeSingle()

  if (!order) {
    console.warn('[webhook/hotmart] bump: pedido não encontrado para sck', orderIdHint)
    return
  }

  const kind = productCode === 'PLAN_TRAINING' ? 'training' : 'recipes'

  await supabase.from('order_items').upsert(
    {
      order_id: order.id,
      kind,
      product_code: productCode,
      unit_price: unitPrice,
      currency,
    },
    { onConflict: 'order_id,product_code', ignoreDuplicates: true },
  )

  console.info('[webhook/hotmart] order bump registrado:', productCode, 'order', order.id, 'status atual:', order.status)

  // Se o produto principal já entregou o plano antes do bump chegar, reabre
  // o pedido e refaz a geração agora que o item extra já está salvo. Se ainda
  // estiver 'pending' ou 'generating', não faz nada: o fluxo principal (ou o
  // próprio retry do Hotmart) vai ler este item quando processar.
  if (order.status === 'delivered') {
    const { data: reopened } = await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', order.id)
      .eq('status', 'delivered')
      .select('id')
      .maybeSingle()

    if (reopened) {
      const result = await processPaidOrder(order.id)
      console.info('[webhook/hotmart] bump: replay de generation', result)
    }
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
  orderIdHint,
}: {
  email: string
  name: string
  transactionId?: string
  orderIdHint?: string
}): Promise<ActivateResult | null> {
  const supabase = createServiceClient()

  // 0. Caminho primário: sck do checkout traz o order_id do pedido pendente.
  //    Deriva a sessão direto do pedido, sem depender de lead por e-mail.
  let hintedSessionId: string | null = null
  if (orderIdHint) {
    const { data: hinted } = await supabase
      .from('orders')
      .select('id, session_id, status')
      .eq('id', orderIdHint)
      .eq('status', 'pending')
      .maybeSingle()
    if (hinted?.session_id) hintedSessionId = hinted.session_id as string
  }

  // 1. Encontrar lead mais recente pelo e-mail (fallback + marcação converted)
  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, country, session_id:generation_sessions(id)')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Sessão: do pedido hintado (sck) ou, em fallback, via lead
  const { data: session } = hintedSessionId
    ? await supabase
        .from('generation_sessions')
        .select('id, country')
        .eq('id', hintedSessionId)
        .maybeSingle()
    : await supabase
        .from('generation_sessions')
        .select('id, country')
        .eq('lead_id', lead?.id ?? '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

  // 2. Encontrar pedido pendente para esta sessão
  const sessionId = session?.id
  if (!sessionId) {
    // Sem sck válido e sem quiz vinculado ao e-mail (ex: payload de teste). Ignorar.
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
