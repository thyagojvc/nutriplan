import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { sendLoginLinkEmail } from '@/lib/email'

const bodySchema = z.object({
  email: z.string().email(),
})

// Login de admin (usado pelo /quiz-funnel). Só gera link se o e-mail já
// existir em admin_users e estiver ativo — o usuário do Supabase Auth
// precisa ter sido criado manualmente antes (ver admin_users no schema).
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

  // Retorna 200 mesmo se não existir para prevenir enumeração de e-mails.
  const { data: admin } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', email)
    .eq('active', true)
    .maybeSingle()

  if (!admin) {
    return NextResponse.json({ ok: true })
  }

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${origin}/auth/callback?next=/quiz-funnel`,
    },
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('[admin/send-link] generateLink error:', linkError)
    return NextResponse.json({ error: 'link_generation_failed' }, { status: 500 })
  }

  const response: Record<string, unknown> = { ok: true }

  // Dev sem chave de e-mail: retorna o hashed_token pro cliente autenticar direto.
  if (process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY) {
    response.dev_hashed_token = linkData.properties.hashed_token
    return NextResponse.json(response)
  }

  const actionLink = linkData.properties.action_link
  if (actionLink) {
    try {
      await sendLoginLinkEmail({ to: email, magicLink: actionLink })
    } catch (emailErr) {
      console.error('[admin/send-link] envio de e-mail falhou:', emailErr)
      return NextResponse.json({ error: 'email_send_failed' }, { status: 500 })
    }
  }

  return NextResponse.json(response)
}
