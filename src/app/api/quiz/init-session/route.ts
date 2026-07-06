import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

// Cria uma generation_session com country=NULL (migration 0013).
// Chamado no carregamento do step 1, antes de qualquer resposta do usuário.
// Idempotente via cookie: se o cookie já existir, retorna a sessão existente.
export async function POST(request: NextRequest) {
  // Se o cliente já tem uma session_id em cookie, reutilizar
  const existingSessionId = request.cookies.get('nutriplan_session_id')?.value
  if (existingSessionId) {
    return NextResponse.json({ session_id: existingSessionId })
  }

  // ad_ref: nome do criativo/anúncio, vindo do parâmetro utm_content da URL
  // (configurado no Meta Ads como utm_content={{ad.name}}). Guardado como chave
  // extra em draft_answers (mesmo padrão dos eventos _ev_*), sem precisar de
  // migration. Só acontece no insert inicial, então não tem risco de race
  // condition como o antigo /api/quiz/track-event tinha (ver migration 0020).
  let body: unknown
  try { body = await request.json() } catch { body = {} }
  const parsed = z.object({ ad_ref: z.string().max(200).optional() }).safeParse(body)
  const adRef = parsed.success ? parsed.data.ad_ref : undefined

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('generation_sessions')
    .insert({
      country: null,
      ...(adRef ? { draft_answers: { _ad_ref: adRef } } : {}),
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[quiz/init-session] insert error:', error)
    return NextResponse.json({ error: 'session_creation_failed' }, { status: 500 })
  }

  const response = NextResponse.json({ session_id: data.id })

  // Cookie HttpOnly: persiste o session_id no servidor, invisível ao JS do cliente
  response.cookies.set('nutriplan_session_id', data.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}
