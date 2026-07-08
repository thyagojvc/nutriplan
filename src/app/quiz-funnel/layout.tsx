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
    redirect('/admin/login')
  }

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) {
    redirect('/admin/login')
  }

  return <>{children}</>
}
