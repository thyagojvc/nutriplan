import { NextResponse } from 'next/server'
import { renderAntiCelulitisPdf } from '@/lib/nutrition/anti-celulitis-pdf'

// DEV-ONLY: gera o PDF do bônus Guía Anti-Celulitis (incluido em todos os tiers).
// http://localhost:3000/dev/anti-celulitis-pdf  (404 em produção)

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const pdf = await renderAntiCelulitisPdf()

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="guia-anti-celulitis.pdf"',
    },
  })
}
