import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPlanReadyEmail } from '@/lib/email'

// Rota de emergência: reenvia magic link para um usuário existente.
// Protegida por ADMIN_SECRET (env var no Vercel).
// Uso: GET /api/admin/resend-link?email=xxx@yyy.com&secret=SUA_SECRET
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const secret = searchParams.get('secret')
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const email = searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'email obrigatório' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Confirma que o usuário existe na tabela users
  const { data: user } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('email', email)
    .maybeSingle()

  if (!user) {
    return NextResponse.json({ error: 'usuário não encontrado em users', email }, { status: 404 })
  }

  // Usa sempre a URL de produção fixa para evitar que NEXT_PUBLIC_APP_URL
  // aponte para um preview do Vercel e bloqueie o acesso da cliente.
  const appUrl = 'https://nutriplan-tzyt.vercel.app'

  const { data: linkData, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: appUrl + '/auth/callback' },
  })

  if (error || !linkData?.properties?.action_link) {
    console.error('[admin/resend-link] generateLink error:', error)
    return NextResponse.json({ error: 'falha ao gerar link', detail: error?.message }, { status: 500 })
  }

  const magicLink = linkData.properties.action_link

  await sendPlanReadyEmail({ to: email, name: user.name, magicLink })

  return NextResponse.json({
    ok: true,
    email,
    name: user.name,
    redirectTo: appUrl + '/dashboard',
    message: 'E-mail enviado com sucesso',
  })
}
