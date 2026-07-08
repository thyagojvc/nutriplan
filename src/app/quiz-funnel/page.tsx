import { createServiceClient } from '@/lib/supabase/service'

const STEP_LABELS: Record<number, string> = {
  1:  'Alimentos favoritos',
  2:  'Objetivo',
  3:  'Alimento imprescindível',
  4:  'Sexo',
  5:  'Dados físicos',
  6:  'Nível de atividade',
  7:  'País detectado',
  8:  'Restrições alimentares',
  9:  'Condições de saúde',
  10: 'Exercício',
  11: 'Obstáculos',
  13: 'Incômodo corporal',
  12: 'Ponte emocional (CTA)',
}

// Steps ocultos (auto-save sem UI): excluídos da análise de abandono.
const HIDDEN_STEPS = new Set([7])

const OFFER_LABELS: Record<string, string> = {
  PLAN_BASIC: 'Solo el plan · 7 días',
  PLAN_RECIPES: 'Plan + 28 Recetas Fitness',
  PLAN_TRAINING: 'Plan + Recetas + Entrenamiento',
  PLAN_STANDARD: 'Plan Standard (legado)',
  TRAINING_BUMP: 'Bump Entrenamiento (legado)',
  PLAN_4WEEKS: 'Transformación 4 semanas (legado)',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pago',
  generating: 'Generando',
  needs_review: 'En revisión',
  delivered: 'Entregado',
  failed: 'Falló',
  refunded: 'Reembolsado',
}

async function getFunnelData(since: string) {
  const supabase = createServiceClient()

  let query = supabase
    .from('generation_sessions')
    .select('draft_answers, created_at')
    .order('created_at', { ascending: false })

  if (since) query = query.gte('created_at', since)

  const [{ data, error }, { data: ordersRows }, { data: recentSalesRows }] = await Promise.all([
    query,
    supabase
      .from('orders')
      .select('session_id, status, order_items(product_code)')
      .gte('created_at', since),
    supabase
      .from('orders')
      .select(`
        id, status, total_amount, currency, created_at, paid_at,
        order_items(product_code),
        generation_sessions(draft_answers),
        users(name, email)
      `)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (error || !data) return null

  // Conta SESSÕES distintas que iniciaram checkout, não linhas de order.
  // Um order é criado por tier clicado (idempotency = sessionId-plan_type),
  // então a mesma pessoa comparando 2 tiers gera 2 orders. Deduplicar por
  // session_id reflete pessoas, não cliques repetidos.
  const ordersCount = new Set((ordersRows ?? []).map((o) => o.session_id)).size

  // Quebra por oferta (tier) + status — responde "para qual oferta foi essa
  // finalização de compra". product_code vem de order_items (1 por order).
  const offerCounts: Record<string, { total: number; byStatus: Record<string, number> }> = {}
  for (const o of ordersRows ?? []) {
    const items = (o as unknown as { order_items?: { product_code: string }[] }).order_items ?? []
    const productCode = items[0]?.product_code ?? 'Sin ítem'
    if (!offerCounts[productCode]) offerCounts[productCode] = { total: 0, byStatus: {} }
    offerCounts[productCode].total += 1
    offerCounts[productCode].byStatus[o.status] = (offerCounts[productCode].byStatus[o.status] ?? 0) + 1
  }

  const total = data.length

  const stepCounts: Record<number, number> = {}
  for (let s = 1; s <= 13; s++) {
    stepCounts[s] = data.filter(
      (r) => r.draft_answers && typeof r.draft_answers === 'object' && `step_${s}` in r.draft_answers,
    ).length
  }

  const hasEvent = (r: { draft_answers: unknown }, key: string) =>
    !!r.draft_answers && typeof r.draft_answers === 'object' && key in (r.draft_answers as object)

  const previewViewed = data.filter((r) => hasEvent(r, '_ev_preview_viewed')).length
  const offerReached = data.filter((r) => hasEvent(r, '_ev_offer_reached')).length
  const tiersReached = data.filter((r) => hasEvent(r, '_ev_tiers_reached')).length
  const pageEnd = data.filter((r) => hasEvent(r, '_ev_page_end')).length

  // País real (ISO detectado no step 7, guardado em country_detail). Cai no
  // código de DB (ex: 'OTHER') se o detalhe não foi salvo (sessões antigas).
  const countryCounts: Record<string, number> = {}
  // Criativo/anúncio de origem (_ad_ref, capturado do utm_content na entrada
  // do quiz). Sessões de antes dessa captura existir caem em "Sin dato".
  const adRefCounts: Record<string, number> = {}
  for (const r of data) {
    const draft = (r.draft_answers ?? {}) as Record<string, unknown>
    const s7 = (draft.step_7 ?? {}) as { country?: string; country_detail?: string }
    const country = s7.country_detail ?? s7.country ?? 'Sin dato'
    countryCounts[country] = (countryCounts[country] ?? 0) + 1

    const adRef = (draft._ad_ref as string | undefined) ?? 'Sin dato'
    adRefCounts[adRef] = (adRefCounts[adRef] ?? 0) + 1
  }

  // Vendas recentes: nome/email só existem depois do webhook criar o user
  // (pending ainda não tem comprador identificado). País vem do dado real
  // (country_detail), não do bucket de preço (que pode ser "OTHER").
  const recentSales = (recentSalesRows ?? []).map((o) => {
    const row = o as unknown as {
      id: string
      status: string
      total_amount: number
      currency: string
      created_at: string
      paid_at: string | null
      order_items?: { product_code: string }[]
      generation_sessions?: { draft_answers?: Record<string, unknown> } | null
      users?: { name: string | null; email: string } | null
    }
    const draft = row.generation_sessions?.draft_answers ?? {}
    const step7 = (draft.step_7 ?? {}) as { country?: string; country_detail?: string }
    return {
      id: row.id,
      status: row.status,
      totalAmount: row.total_amount,
      currency: row.currency,
      createdAt: row.created_at,
      productCode: row.order_items?.[0]?.product_code ?? 'Sin ítem',
      country: step7.country_detail ?? step7.country ?? '—',
      adRef: (draft._ad_ref as string | undefined) ?? '—',
      buyerName: row.users?.name ?? null,
      buyerEmail: row.users?.email ?? null,
    }
  })

  return { total, stepCounts, previewViewed, offerReached, tiersReached, pageEnd, ordersCount: ordersCount ?? 0, countryCounts, offerCounts, recentSales, adRefCounts }
}

export default async function QuizFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ since?: string }>
}) {
  const params = await searchParams
  // Padrão: hoje (a partir de agora). Formato: YYYY-MM-DD
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const since = params.since ?? today

  const data = await getFunnelData(since)

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center text-muted-foreground">
        Erro ao carregar dados. Verifique a conexão com o Supabase.
      </div>
    )
  }

  const { total, stepCounts, previewViewed, offerReached, tiersReached, pageEnd, ordersCount, countryCounts, offerCounts, recentSales, adRefCounts } = data
  const step1 = stepCounts[1] || 1
  const countryRows = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])
  const offerRows = Object.entries(offerCounts).sort((a, b) => b[1].total - a[1].total)
  const adRefRows = Object.entries(adRefCounts).sort((a, b) => b[1] - a[1])

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 pb-20">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Funil do quiz</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} sessões a partir de <strong>{since}</strong>
          </p>
        </div>

        {/* Filtros rápidos */}
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { label: 'Hoje', value: today },
            { label: '7 dias', value: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10) },
            { label: '30 dias', value: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) },
            { label: 'Tudo', value: '2024-01-01' },
          ].map(({ label, value }) => (
            <a
              key={value}
              href={`/quiz-funnel?since=${value}`}
              className={[
                'rounded-full border px-3 py-1 font-medium transition-colors',
                since === value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted',
              ].join(' ')}
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Step</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 text-right font-medium">Completaram</th>
              <th className="px-4 py-3 text-right font-medium">% do início</th>
              <th className="px-4 py-3 text-right font-medium">Abandono</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: 13 }, (_, i) => i + 1).map((step) => {
              const isHidden = HIDDEN_STEPS.has(step)
              const count = stepCounts[step] ?? 0
              const prev = step === 1 ? step1 : (stepCounts[step - 1] ?? 0)
              const pctStart = step1 > 0 ? Math.round((count / step1) * 100) : 0
              const dropPct = prev > 0 ? Math.round(((prev - count) / prev) * 100) : 0
              const isHighDrop = !isHidden && dropPct >= 20

              return (
                <tr key={step} className={['transition-colors', isHidden ? 'opacity-40' : 'hover:bg-muted/30'].join(' ')}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {step}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {STEP_LABELS[step]}
                    {isHidden && <span className="ml-2 text-[10px] text-muted-foreground">(oculto)</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span
                      className={[
                        'inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
                        pctStart >= 70
                          ? 'bg-green-100 text-green-700'
                          : pctStart >= 40
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700',
                      ].join(' ')}
                    >
                      {pctStart}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {step === 1 || isHidden ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className={['text-xs font-medium', isHighDrop ? 'text-red-600' : 'text-muted-foreground'].join(' ')}>
                        {isHighDrop ? '⚠ ' : ''}{dropPct}%
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {/* Linha: Preview visualizada */}
            {(() => {
              const count = previewViewed
              const prev = stepCounts[12] ?? 0
              const pctStart = step1 > 0 ? Math.round((count / step1) * 100) : 0
              const dropPct = prev > 0 ? Math.round(((prev - count) / prev) * 100) : 0
              return (
                <tr className="hover:bg-muted/30 transition-colors border-t-2 border-primary/20">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">—</td>
                  <td className="px-4 py-3 font-medium text-primary">Viram a preview</td>
                  <td className="px-4 py-3 text-right tabular-nums">{count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={['inline-block rounded-full px-2 py-0.5 text-xs font-semibold', pctStart >= 70 ? 'bg-green-100 text-green-700' : pctStart >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'].join(' ')}>
                      {pctStart}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={['text-xs font-medium', dropPct >= 20 ? 'text-red-600' : 'text-muted-foreground'].join(' ')}>
                      {dropPct >= 20 ? '⚠ ' : ''}{dropPct}%
                    </span>
                  </td>
                </tr>
              )
            })()}

            {/* Linha: Chegaram na oferta (scroll) */}
            {(() => {
              const count = offerReached
              const prev = previewViewed
              const pctStart = step1 > 0 ? Math.round((count / step1) * 100) : 0
              const dropPct = prev > 0 ? Math.round(((prev - count) / prev) * 100) : 0
              return (
                <tr className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">—</td>
                  <td className="px-4 py-3 font-medium text-primary">Chegaram na oferta</td>
                  <td className="px-4 py-3 text-right tabular-nums">{count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={['inline-block rounded-full px-2 py-0.5 text-xs font-semibold', pctStart >= 70 ? 'bg-green-100 text-green-700' : pctStart >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'].join(' ')}>
                      {pctStart}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={['text-xs font-medium', dropPct >= 20 ? 'text-red-600' : 'text-muted-foreground'].join(' ')}>
                      {dropPct >= 20 ? '⚠ ' : ''}{dropPct}%
                    </span>
                  </td>
                </tr>
              )
            })()}

            {/* Linha: Chegaram nos botões de tier (scroll) */}
            {(() => {
              const count = tiersReached
              const prev = offerReached
              const pctStart = step1 > 0 ? Math.round((count / step1) * 100) : 0
              const dropPct = prev > 0 ? Math.round(((prev - count) / prev) * 100) : 0
              return (
                <tr className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">—</td>
                  <td className="px-4 py-3 font-medium text-primary">Chegaram nos botões</td>
                  <td className="px-4 py-3 text-right tabular-nums">{count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={['inline-block rounded-full px-2 py-0.5 text-xs font-semibold', pctStart >= 70 ? 'bg-green-100 text-green-700' : pctStart >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'].join(' ')}>
                      {pctStart}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={['text-xs font-medium', dropPct >= 20 ? 'text-red-600' : 'text-muted-foreground'].join(' ')}>
                      {dropPct >= 20 ? '⚠ ' : ''}{dropPct}%
                    </span>
                  </td>
                </tr>
              )
            })()}

            {/* Linha: Leram até o fim (após FAQ) */}
            {(() => {
              const count = pageEnd
              const prev = tiersReached
              const pctStart = step1 > 0 ? Math.round((count / step1) * 100) : 0
              const dropPct = prev > 0 ? Math.round(((prev - count) / prev) * 100) : 0
              return (
                <tr className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">—</td>
                  <td className="px-4 py-3 font-medium text-primary">Leram até o fim</td>
                  <td className="px-4 py-3 text-right tabular-nums">{count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={['inline-block rounded-full px-2 py-0.5 text-xs font-semibold', pctStart >= 70 ? 'bg-green-100 text-green-700' : pctStart >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'].join(' ')}>
                      {pctStart}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={['text-xs font-medium', dropPct >= 20 ? 'text-red-600' : 'text-muted-foreground'].join(' ')}>
                      {dropPct >= 20 ? '⚠ ' : ''}{dropPct}%
                    </span>
                  </td>
                </tr>
              )
            })()}

            {/* Linha: Clicaram no Hotmart */}
            {(() => {
              const count = ordersCount
              const prev = tiersReached
              const pctStart = step1 > 0 ? Math.round((count / step1) * 100) : 0
              const dropPct = prev > 0 ? Math.round(((prev - count) / prev) * 100) : 0
              return (
                <tr className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">—</td>
                  <td className="px-4 py-3 font-medium text-primary">Clicaram no Hotmart</td>
                  <td className="px-4 py-3 text-right tabular-nums">{count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={['inline-block rounded-full px-2 py-0.5 text-xs font-semibold', pctStart >= 70 ? 'bg-green-100 text-green-700' : pctStart >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'].join(' ')}>
                      {pctStart}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={['text-xs font-medium', dropPct >= 20 ? 'text-red-600' : 'text-muted-foreground'].join(' ')}>
                      {dropPct >= 20 ? '⚠ ' : ''}{dropPct}%
                    </span>
                  </td>
                </tr>
              )
            })()}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Steps ocultos (sem UI) aparecem esmaecidos e sem abandono calculado.
        Abandono ⚠ sinaliza queda ≥ 20% em relação ao step anterior.
      </p>

      {/* Vendas recentes — identifica cada pedido: comprador (se já pago), país real, produto e status */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border bg-muted/50 px-4 py-3">
          <p className="text-sm font-semibold">Ventas recientes</p>
          <p className="text-xs text-muted-foreground">Últimas 20 · comprador solo aparece después del webhook (pending aún no tiene datos)</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Comprador</th>
              <th className="px-4 py-2 font-medium">País</th>
              <th className="px-4 py-2 font-medium">Anuncio</th>
              <th className="px-4 py-2 font-medium">Producto</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recentSales.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-3 text-muted-foreground">Sin ventas en el período.</td></tr>
            )}
            {recentSales.map((s) => (
              <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(s.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-2.5">
                  {s.buyerEmail ? (
                    <p className="font-medium">{s.buyerName?.trim().split(' ')[0] || 'Cliente'}</p>
                  ) : (
                    <span className="text-xs text-muted-foreground">— pendiente —</span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{s.country}</td>
                <td className="px-4 py-2.5 text-xs">{s.adRef}</td>
                <td className="px-4 py-2.5 text-xs">{OFFER_LABELS[s.productCode] ?? s.productCode}</td>
                <td className="px-4 py-2.5 text-xs">{STATUS_LABELS[s.status] ?? s.status}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                  {s.currency} {s.totalAmount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ofertas — para qual tier foi cada finalização de compra, com status real */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border bg-muted/50 px-4 py-3">
          <p className="text-sm font-semibold">Ofertas</p>
          <p className="text-xs text-muted-foreground">Checkouts iniciados por tier. &quot;Pendiente&quot; = iniciou o pagamento mas ainda não confirmado na Hotmart.</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {offerRows.length === 0 && (
              <tr><td className="px-4 py-3 text-muted-foreground">Sem checkouts no período.</td></tr>
            )}
            {offerRows.map(([productCode, { total: offerTotal, byStatus }]) => (
              <tr key={productCode} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{OFFER_LABELS[productCode] ?? productCode}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {Object.entries(byStatus)
                      .map(([status, c]) => `${STATUS_LABELS[status] ?? status}: ${c}`)
                      .join(' · ')}
                  </p>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{offerTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Criativos — utm_content capturado na entrada do quiz. Sessões antes dessa
          captura existir (ou tráfego sem utm) caem em "Sin dato". */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border bg-muted/50 px-4 py-3">
          <p className="text-sm font-semibold">Criativos</p>
          <p className="text-xs text-muted-foreground">Configura utm_content={'{{ad.name}}'} nos parâmetros de URL do anúncio no Meta Ads pra aparecer aqui</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {adRefRows.length === 0 && (
              <tr><td className="px-4 py-3 text-muted-foreground">Sem sessões no período.</td></tr>
            )}
            {adRefRows.map(([adRef, count]) => (
              <tr key={adRef} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 text-xs">{adRef}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{count}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                  {total > 0 ? Math.round((count / total) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Países — país real detectado no step 7 (country_detail), não o tier de preço */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border bg-muted/50 px-4 py-3">
          <p className="text-sm font-semibold">Países</p>
          <p className="text-xs text-muted-foreground">País detectado por sessão (mesma pessoa em aparelhos diferentes conta mais de uma vez)</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {countryRows.length === 0 && (
              <tr><td className="px-4 py-3 text-muted-foreground">Sem sessões no período.</td></tr>
            )}
            {countryRows.map(([country, count]) => (
              <tr key={country} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs">{country}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{count}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                  {total > 0 ? Math.round((count / total) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
