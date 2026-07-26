import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const bodySchema = z.object({
  // save_step_failed = save-step respondeu erro (ex: 401 sem sessão);
  // save_step_error = fetch nem completou (rede/CORS). Diagnóstico do abandono
  // iOS na 1ª pergunta: sessão sem steps COM esse evento = pessoa tentou e o
  // save falhou; sem o evento = nem tocou em Continuar (problema de UI).
  event: z.enum(['preview_viewed', 'offer_reached', 'tiers_reached', 'page_end', 'save_step_failed', 'save_step_error', 'js_error', 'q1_interacted']),
  // Só para js_error: mensagem resumida do erro, vira sufixo do valor gravado.
  detail: z.string().max(200).optional(),
})

// Registra eventos de funil pós-quiz em draft_answers como chaves extras
// (ex: { _ev_preview_viewed: "2026-07-01T..." }).
// Usa a RPC track_funnel_event (migration 0020): merge atômico via jsonb ||
// direto no UPDATE. Antes fazia SELECT + merge em JS + UPDATE, o que perdia
// eventos quando dois disparavam próximos (ex: scroll rápido cruzando
// offer_reached e tiers_reached quase junto) — a escrita que chegava por
// último sobrescrevia a coluna inteira e apagava o evento da outra.
export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('nutriplan_session_id')?.value
  if (!sessionId) return NextResponse.json({ ok: false }, { status: 200 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ ok: false }) }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false })

  let key = `_ev_${parsed.data.event}`
  // js_error carrega a mensagem no próprio nome da chave (a RPC só grava
  // chave→timestamp; sem migration não há onde pôr valor). Sanitizado e
  // limitado pra não explodir o jsonb.
  if (parsed.data.event === 'js_error' && parsed.data.detail) {
    key += '__' + parsed.data.detail.replace(/[^a-zA-Z0-9 _.:-]/g, ' ').slice(0, 80)
  }
  const supabase = createServiceClient()

  await supabase.rpc('track_funnel_event', { p_session_id: sessionId, p_key: key })

  return NextResponse.json({ ok: true })
}
