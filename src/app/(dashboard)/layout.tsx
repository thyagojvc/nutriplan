import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Guard de sessão para todas as rotas do grupo (dashboard).
// O middleware já bloqueia na borda, mas este guard é a segunda barreira
// caso o middleware seja bypassado ou a sessão expire entre requests.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <>{children}</>
}
