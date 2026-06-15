import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Cria uma generation_session com country=NULL (migration 0013).
// Chamado no carregamento do step 1, antes de qualquer resposta do usuário.
// Idempotente via cookie: se o cookie já existir, retorna a sessão existente.
export async function POST(request: NextRequest) {
  // Se o cliente já tem uma session_id em cookie, reutilizar
  const existingSessionId = request.cookies.get('nutriplan_session_id')?.value
  if (existingSessionId) {
    return NextResponse.json({ session_id: existingSessionId })
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('generation_sessions')
    .insert({ country: null })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[quiz/init-session] insert error:', error)
    return NextResponse.json({ error: 'session_creation_failed' }, { status: 500 })
  }

  const response = NextResponse.json({ session_id: data.id })

  // Cookie HttpOnly: persiste o session_id no servidor, invisível ao JS do cliente
  response.cookies.set('nutriplan_session_id', data.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}
