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

  if (error) return NextResponse.json({ total: 0, counts: {}, at: new Date().toISOString() })

  const now = Date.now()
  const counts: Record<number, number> = {}
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
  }

  return NextResponse.json({ total, counts, at: new Date().toISOString() })
}
