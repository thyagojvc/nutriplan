import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Guard de admin para o dashboard interno do funil. Segunda barreira além do
// middleware: usa a mesma função is_admin() (RLS, security definer) que já
// protege as demais tabelas administrativas.
export default async function QuizFunnelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login?error=no_session')
  }

  const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin')
  if (rpcError) {
    console.error('[quiz-funnel/layout] is_admin rpc error:', user.email, rpcError)
  }
  if (!isAdmin) {
    console.warn('[quiz-funnel/layout] usuário autenticado mas não é admin:', user.email)
    redirect('/admin/login?error=not_admin')
  }

  return <>{children}</>
}
