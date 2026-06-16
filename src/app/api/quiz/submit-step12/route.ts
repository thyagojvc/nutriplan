import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  country: z.string().min(2).max(5), // 'OTHER' p/ países fora dos 4 com preço local dedicado
  ip: z.string().ip().optional(),
  policy_version: z.string().min(1),
  consent_text: z.string().min(1),
})

// Chama submit_quiz_step12_atomic (migration 0013).
// A RPC é idempotente: retorna lead_id existente se a sessão já foi submetida.
export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('nutriplan_session_id')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_params' }, { status: 400 })
  }

  const { email, name, country, ip, policy_version, consent_text } = parsed.data

  // IP real do visitante para o consent_record
  const clientIp =
    ip ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0'

  const supabase = createServiceClient()

  const { data: leadId, error } = await supabase.rpc('submit_quiz_step12_atomic', {
    p_session_id: sessionId,
    p_ip: clientIp,
    p_country: country,
    p_policy_version: policy_version,
    p_consent_text: consent_text,
    p_email: email,
    p_name: name,
  })

  if (error) {
    console.error('[quiz/submit-step12] rpc error:', error)

    // A RPC levanta exceção com mensagem estruturada se country ainda for NULL
    if (error.message?.includes('session_invalid_or_country_missing')) {
      return NextResponse.json(
        { error: 'country_not_set', message: 'El paso 7 no fue completado.' },
        { status: 422 },
      )
    }

    return NextResponse.json({ error: 'submit_failed' }, { status: 500 })
  }

  return NextResponse.json({ lead_id: leadId })
}
