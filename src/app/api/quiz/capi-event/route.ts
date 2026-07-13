import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendFacebookFunnelEvent } from '@/lib/fb-conversions-api'

// Espelha os eventos de funil do pixel (client-side) também pela Conversions API
// (server-side), com melhor match quality: external_id (UUID da sessão), fbc/fbp,
// IP e user-agent confiáveis. O event_id chega do cliente e é o MESMO usado no
// pixel, então o Meta desduplica e não conta o evento em dobro.
//
// Só aceita a lista fixa de eventos do funil — nada de evento arbitrário vindo
// do cliente. Fire-and-forget: responde ok na hora, não trava a navegação.

const FUNNEL_EVENTS = ['QuizStart', 'QuizFirstAnswer', 'ViewContent', 'QuizComplete'] as const

const bodySchema = z.object({
  event_name: z.enum(FUNNEL_EVENTS),
  event_id: z.string().min(1).max(100),
  // ViewContent é evento padrão do Meta; os demais são custom.
  is_custom: z.boolean().optional(),
  // fbclid da URL do clique do anúncio: fallback pra reconstruir o _fbc caso o
  // cookie não exista (pixel bloqueado por adblock e afins).
  fbclid: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('nutriplan_session_id')?.value ?? null

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ ok: false }) }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false })

  const { event_name, event_id, is_custom, fbclid } = parsed.data

  let fbc = request.cookies.get('_fbc')?.value ?? null
  const fbp = request.cookies.get('_fbp')?.value ?? null
  // Reconstrói o _fbc no formato do Meta quando o cookie faltou mas temos o
  // fbclid: fb.1.<timestamp_ms>.<fbclid>.
  if (!fbc && fbclid) {
    fbc = `fb.1.${Date.now()}.${fbclid}`
  }

  const clientUserAgent = request.headers.get('user-agent') ?? null
  const clientIpAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  void sendFacebookFunnelEvent({
    eventName: event_name,
    eventId: event_id,
    isCustom: is_custom,
    sessionId,
    fbc,
    fbp,
    clientIpAddress,
    clientUserAgent,
  })

  return NextResponse.json({ ok: true })
}
