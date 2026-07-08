'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Callback de autenticação exclusivo do admin. Caminho fixo, sem query string,
// pra não depender de a lista de Redirect URLs do Supabase aceitar parâmetros
// extras (o /auth/callback com ?next= voltava pro destino padrão porque a
// URL com query não batia com a allow-list configurada no painel).
export default function AdminAuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const searchParams = new URLSearchParams(window.location.search)
    const code = searchParams.get('code')

    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        router.replace(error ? '/admin/login?error=auth_failed' : '/quiz-funnel')
      })
    } else if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          router.replace(error ? '/admin/login?error=auth_failed' : '/quiz-funnel')
        })
    } else {
      router.replace('/admin/login?error=auth_failed')
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#16a34a] border-r-transparent" />
    </div>
  )
}
