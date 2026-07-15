import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { deriveTrackingId } from '@/lib/fb-conversions-api'

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

// Robôs/crawlers que executam a página (rastreador do Facebook, scanners,
// monitores de uptime, bots de datacenter US) criavam sessões-fantasma vazias
// no funil. Filtramos pelo user-agent — regex simples em memória, sem chamada
// externa e sem custo de latência. Só evita CRIAR sessão pra bot; não afeta
// nenhuma pessoa real nem o carregamento da página.
//
// IMPORTANTE: lista conservadora, só com tokens que NUNCA aparecem em navegador
// de pessoa real (nem no in-app do WhatsApp/Instagram/Facebook, comuns no LATAM).
// Por isso evitamos termos ambíguos como "preview", "monitor", "scan", "whatsapp".
const BOT_UA = /bot\b|crawl|spider|slurp|facebookexternalhit|meta-externalagent|headless|phantomjs|puppeteer|playwright|python-requests|python-urllib|curl\/|wget|go-http-client|okhttp|axios\/|node-fetch|lighthouse|pingdom|uptimerobot|statuscake|semrushbot|ahrefsbot|mj12bot|dotbot|bingpreview|yandexbot|dataprovider/i

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()

  // Se o cliente já tem uma session_id em cookie, reutilizar — MAS só se a linha
  // ainda existir no banco. Um cookie órfão (a sessão foi apagada pela limpeza de
  // sessões abandonadas `lead_id IS NULL`, por bots, etc., mas o cookie dura 7 dias)
  // fazia o save-step chamar save_quiz_draft_step com um id inexistente, que
  // RAISE EXCEPTION session_not_found → 500 → "Error al guardar" logo no 1º passo.
  // Era o que travava quem abandonava e voltava (a segunda tentativa). Nesse caso,
  // seguimos o fluxo abaixo e criamos uma sessão nova (sobrescrevendo o cookie).
  const existingSessionId = request.cookies.get('nutriplan_session_id')?.value
  let orphanedSessionId: string | undefined
  if (existingSessionId) {
    const { data: existing } = await supabase
      .from('generation_sessions')
      .select('id')
      .eq('id', existingSessionId)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ session_id: existingSessionId, tracking_id: deriveTrackingId(existingSessionId) })
    }
    // Cookie órfão → cai fora do if e cria sessão nova. Registramos (log +
    // marca persistida em draft_answers) pra dar visibilidade real: logs do
    // Vercel somem em 1-3 dias (retenção do plano), mas o banco fica pra sempre
    // e dá pra contar quantas vezes isso aconteceu quando quiser, sem depender
    // de log nenhum.
    orphanedSessionId = existingSessionId
    console.warn('[quiz/init-session] orphaned session cookie healed:', existingSessionId)
  }

  // Bot conhecido → responde ok sem criar sessão (não polui o funil).
  const ua = request.headers.get('user-agent') ?? ''
  if (!ua || BOT_UA.test(ua)) {
    return NextResponse.json({ session_id: null, bot: true })
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
  // Marca permanente (não expira com log): permite consultar no banco, a
  // qualquer momento, quantas sessões nasceram de um cookie órfão.
  if (orphanedSessionId) draftAnswers._healed_orphan_from = orphanedSessionId

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

  const response = NextResponse.json({ session_id: data.id, tracking_id: deriveTrackingId(data.id) })

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
