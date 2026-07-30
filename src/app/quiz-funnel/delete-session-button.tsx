'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Botão de apagar lead falso/teste direto na tabela "Todos los individuos".
// Guarda o ADMIN_SECRET no sessionStorage do navegador depois do 1º acerto,
// pra não pedir de novo em cada linha apagada na mesma sessão do painel.
export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    if (!window.confirm('¿Eliminar esta sesión? No se puede deshacer.')) return

    let secret = sessionStorage.getItem('quiz_funnel_admin_secret')
    if (!secret) {
      secret = window.prompt('Código de administrador:')
      if (!secret) return
    }

    setPending(true)
    try {
      const res = await fetch('/api/admin/delete-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, secret }),
      })

      if (res.status === 401) {
        sessionStorage.removeItem('quiz_funnel_admin_secret')
        alert('Código incorrecto.')
        setPending(false)
        return
      }
      if (!res.ok) {
        alert('Error al eliminar la sesión.')
        setPending(false)
        return
      }

      sessionStorage.setItem('quiz_funnel_admin_secret', secret)
      router.refresh()
    } catch {
      alert('Error de red.')
      setPending(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      title="Eliminar sesión (lead falso)"
      className="rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
    >
      {pending ? '…' : '✕'}
    </button>
  )
}
