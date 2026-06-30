import { NextResponse } from 'next/server'
import { SUPPORTED_CURRENCIES } from '@/lib/pricing/localize'

// =============================================================================
// NutriPlan — Cotação de câmbio (USD base) para localizar o preço na exibição.
// Fonte: open.er-api.com (gratuita, sem chave, atualiza ~1x/dia).
// Cache de 12h via revalidate: o preço fica estável dentro do dia e não martela
// a API. Em caso de falha, devolve rates vazio e a página cai no fallback USD.
// =============================================================================

const FX_URL = 'https://open.er-api.com/v6/latest/USD'
const TWELVE_HOURS = 60 * 60 * 12

export const revalidate = TWELVE_HOURS

export async function GET() {
  try {
    const res = await fetch(FX_URL, { next: { revalidate: TWELVE_HOURS } })
    const json = await res.json()

    if (json?.result !== 'success' || !json?.rates) {
      return NextResponse.json({ rates: {} }, { status: 200 })
    }

    // Devolve só as moedas que usamos, payload enxuto.
    const rates: Record<string, number> = {}
    for (const cur of SUPPORTED_CURRENCIES) {
      if (typeof json.rates[cur] === 'number') rates[cur] = json.rates[cur]
    }

    return NextResponse.json({ rates, updatedAt: json.time_last_update_unix ?? null })
  } catch {
    return NextResponse.json({ rates: {} }, { status: 200 })
  }
}
