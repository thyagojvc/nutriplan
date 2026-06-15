import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const bodySchema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }

  const { email } = parsed.data
  const supabase = createServiceClient()

  // Verifica se o usuário existe antes de gerar o link.
  // Retorna 200 mesmo se não existir para prevenir enumeração de e-mails.
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (!existingUser) {
    return NextResponse.json({ ok: true })
  }

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('[send-link] generateLink error:', linkError)
    return NextResponse.json({ error: 'link_generation_failed' }, { status: 500 })
  }

  // TODO Fase B: enviar e-mail via Resend
  // await resend.emails.send({
  //   from: 'NutriPlan <noreply@nutriplan.com>',
  //   to: email,
  //   subject: 'Tu enlace de acceso a NutriPlan',
  //   html: `<a href="${linkData.properties.action_link}">Acceder a mi plan</a>`,
  // })

  const response: Record<string, unknown> = { ok: true }

  // Em dev: retorna o hashed_token para o cliente chamar verifyOtp diretamente
  if (process.env.NODE_ENV !== 'production') {
    response.dev_hashed_token = linkData.properties.hashed_token
  }

  return NextResponse.json(response)
}
