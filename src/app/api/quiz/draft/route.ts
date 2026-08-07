import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Devolve o draft bruto da sessão do quiz (respostas + país).
//
// Existe para o /mi-plan, que precisa gerar o PLANO inteiro no cliente, não só
// o resumo: /api/quiz/preview-data devolve perfil, metas e uma amostra, o que
// basta pra página de vendas mas não pra montar os 7 dias. Aqui volta o draft
// cru e o cliente roda o mesmo gerador determinístico que o pós-compra usa,
// garantindo que o plano mostrado antes de pagar seja igual ao entregue.
//
// Só devolve dados da própria sessão da pessoa (cookie), nada agregado.
export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('nutriplan_session_id')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: session } = await supabase
    .from('generation_sessions')
    .select('draft_answers, country')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session?.draft_answers) {
    return NextResponse.json({ error: 'no_answers' }, { status: 404 })
  }

  return NextResponse.json({
    draft_answers: session.draft_answers,
    country: (session.country as string) ?? 'OTHER',
  })
}
