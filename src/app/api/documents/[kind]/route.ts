import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const VALID_KINDS = ['nutrition_plan', 'training_plan', 'implementation_guide']
const DOCS_BUCKET = 'documents'
const SIGNED_URL_TTL = 120 // segundos

// GET /api/documents/:kind
// Gera uma URL assinada temporária e redireciona o navegador para o PDF.
// Acesso controlado: a rota exige sessão (middleware) e o documento é resolvido
// SEMPRE pelo id do usuário autenticado — nunca por id vindo da URL.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params
  if (!VALID_KINDS.includes(kind)) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const svc = createServiceClient()

  const { data: publicUser } = await svc
    .from('users')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!publicUser) return NextResponse.json({ error: 'no_account' }, { status: 404 })

  // pedido entregue mais recente do usuário
  const { data: order } = await svc
    .from('orders')
    .select('id')
    .eq('user_id', publicUser.id)
    .eq('status', 'delivered')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'no_delivered_order' }, { status: 404 })

  const { data: doc } = await svc
    .from('generated_documents')
    .select('storage_path')
    .eq('order_id', order.id)
    .eq('kind', kind)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'document_not_found' }, { status: 404 })

  const { data: signed, error } = await svc.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL)
  if (error || !signed) {
    return NextResponse.json({ error: 'signing_failed' }, { status: 500 })
  }

  return NextResponse.redirect(signed.signedUrl)
}
