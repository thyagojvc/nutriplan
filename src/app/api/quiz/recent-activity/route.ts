import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// =============================================================================
// NutriPlan — Prueba social honesta: cuenta compras reales recientes.
// Empieza en 24h y va ampliando la ventana (7d, 30d) hasta encontrar un
// número que valga la pena mostrar. Si ni en 30 días hay suficiente volumen,
// no devuelve nada — mejor no mostrar el sello que mostrar un número ínfimo.
// =============================================================================

const WINDOWS: { hours: number; label: string }[] = [
  { hours: 24, label: 'en las últimas 24 horas' },
  { hours: 24 * 7, label: 'esta semana' },
  { hours: 24 * 30, label: 'este mes' },
]

const MIN_COUNT = 3

export async function GET() {
  try {
    const supabase = createServiceClient()

    for (const { hours, label } of WINDOWS) {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['paid', 'generating', 'delivered'])
        .gte('created_at', since)

      if (typeof count === 'number' && count >= MIN_COUNT) {
        return NextResponse.json({ count, label })
      }
    }

    return NextResponse.json({ count: null, label: null })
  } catch {
    return NextResponse.json({ count: null, label: null })
  }
}
