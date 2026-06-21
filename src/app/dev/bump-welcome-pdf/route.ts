import { NextResponse } from 'next/server'
import { renderWelcomePdf } from '@/lib/nutrition/welcome-pdf'

// DEV-ONLY: gera o PDF de boas-vindas do order bump (Plan de Entrenamiento).
// http://localhost:3000/dev/bump-welcome-pdf  (404 em produção)

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const pdf = await renderWelcomePdf()

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="bienvenida-plan-entrenamiento.pdf"',
    },
  })
}
