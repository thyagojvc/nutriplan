import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

// O manifest só é linkado AQUI, dentro do grupo (dashboard) — não mais no
// layout raiz. Antes (src/app/manifest.ts) ele cobria o site inteiro e o
// Chrome oferecia "Instalar app" até no quiz/preview, antes da compra.
export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  icons: {
    apple: '/logo-calibra-transparent.png',
  },
}

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
