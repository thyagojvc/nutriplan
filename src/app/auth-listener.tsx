'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

// Captura o access_token que o Supabase manda no hash da URL quando usa implicit
// flow (/#access_token=...). O middleware SSR não vê hash, então isso precisa ser
// client-side. Após estabelecer a sessão, redireciona pro dashboard.
export function AuthListener() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.location.hash.includes('access_token')) return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        subscription.unsubscribe()
        router.replace('/dashboard')
      }
    })

    // Limpa se não disparar em 5s
    const timeout = setTimeout(() => subscription.unsubscribe(), 5000)
    return () => { clearTimeout(timeout); subscription.unsubscribe() }
  }, [router])

  return null
}
