import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

// Janela de "ao vivo": só conta quem deu heartbeat nos últimos LIVE_WINDOW ms.
// Com o heartbeat do quiz a cada 8s, 25s tolera um beat perdido e faz a pessoa
// sumir ~25s depois de fechar a aba.
const LIVE_WINDOW_MS = 25_000

// Converte o now()::text do Postgres ("2026-07-12 11:35:36.154917+00") em epoch.
function parseTs(v: string): number {
  let s = v.replace(' ', 'T')
  s = s.replace(/([+-]\d{2})$/, '$1:00') // "+00" -> "+00:00"
  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}

// GET /api/quiz/live-presence
// Retorna quantas pessoas estão AGORA em cada etapa visível do quiz.
// { total, counts: { <etapaVisível>: <nº pessoas> }, at }
export async function GET() {
  const supabase = createServiceClient()

  // Pré-filtro por updated_at (o heartbeat bumpa updated_at) só para não varrer
  // a tabela inteira; a decisão de "está vivo" é pelo timestamp do _live_ abaixo.
  const threshold = new Date(Date.now() - LIVE_WINDOW_MS - 5_000).toISOString()

  const { data, error } = await supabase
    .from('generation_sessions')
    .select('id, draft_answers')
    .gte('updated_at', threshold)
    .limit(300)

  if (error) return NextResponse.json({ total: 0, counts: {}, sessions: [], at: new Date().toISOString() })

  const now = Date.now()
  const counts: Record<number, number> = {}
  const sessions: { step: number; country: string; adRef: string | null }[] = []
  let total = 0

  for (const s of data ?? []) {
    const draft = (s.draft_answers ?? {}) as Record<string, unknown>
    let bestStep = -1
    let bestVal = ''
    for (const [k, v] of Object.entries(draft)) {
      if (!k.startsWith('_live_')) continue
      const val = String(v)
      if (val > bestVal) { bestVal = val; bestStep = parseInt(k.slice(6), 10) }
    }
    if (bestStep < 1) continue
    if (now - parseTs(bestVal) > LIVE_WINDOW_MS) continue // heartbeat velho: já saiu
    counts[bestStep] = (counts[bestStep] ?? 0) + 1
    total++

    // Identifica CADA sessão individualmente (país, criativo) — sem isso, com
    // 2+ pessoas ao mesmo tempo o painel só mostrava um número agregado por
    // etapa, sem dar pra saber quem é quem.
    const s7 = (draft.step_7 ?? {}) as { country?: string; country_detail?: string }
    const country = s7.country_detail ?? s7.country ?? (draft._detected_country as string | undefined) ?? '—'
    const adRef = (draft._ad_ref as string | undefined) ?? null
    sessions.push({ step: bestStep, country, adRef })
  }

  sessions.sort((a, b) => a.step - b.step)

  return NextResponse.json({ total, counts, sessions, at: new Date().toISOString() })
}
