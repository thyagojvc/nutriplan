import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

// O manifest global (src/app/manifest.ts) já cobre o site inteiro; aqui só
// trocamos o ícone de instalação pelo ícone quadrado (o layout raiz usa a
// wordmark, ruim como ícone de tela de início).
export const metadata: Metadata = {
  icons: {
    apple: '/logo-calibra-white.png',
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
