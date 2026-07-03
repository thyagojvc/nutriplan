'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Callback de autenticação — lida com dois fluxos do Supabase:
//   PKCE (moderno):   ?code=xxx  → exchangeCodeForSession
//   Implicit (legado): #access_token=xxx → setSession
// O route handler server-side não consegue ler hash fragments (não enviados ao servidor).
export default function AuthCallbackPage() {
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
        router.replace(error ? '/login?error=auth_failed' : '/dashboard')
      })
    } else if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          router.replace(error ? '/login?error=auth_failed' : '/dashboard')
        })
    } else {
      router.replace('/login?error=auth_failed')
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#16a34a] border-r-transparent" />
    </div>
  )
}
