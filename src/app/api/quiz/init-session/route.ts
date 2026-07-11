import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

// Apenas estes 4 têm preço em moeda local dedicado; todo o resto cai em 'OTHER'
// (mesma regra de step7-country-select.tsx, duplicada aqui de propósito — sem
// importar componente 'use client' num route handler).
const PRICED_COUNTRIES = new Set(['MX', 'CO', 'CL', 'ES'])
function toDbCountry(code: string | undefined): 'MX' | 'CO' | 'CL' | 'ES' | 'OTHER' {
  return code && PRICED_COUNTRIES.has(code) ? (code as 'MX' | 'CO' | 'CL' | 'ES') : 'OTHER'
}

// Cria uma generation_session já com o país detectado por IP (Vercel), mesmo
// antes de qualquer resposta do usuário — permite identificar a origem de
// sessões que abandonam antes do step 7 (onde o país era capturado antes).
// Chamado no carregamento do step 1.
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

  const detectedCountry = request.headers.get('x-vercel-ip-country') ?? undefined
  const dbCountry = toDbCountry(detectedCountry)

  const draftAnswers: Record<string, unknown> = {}
  if (adRef) draftAnswers._ad_ref = adRef
  if (detectedCountry) draftAnswers._detected_country = detectedCountry

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('generation_sessions')
    .insert({
      country: dbCountry,
      ...(Object.keys(draftAnswers).length > 0 ? { draft_answers: draftAnswers } : {}),
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
