import { createServiceClient } from '@/lib/supabase/service'
import { LivePresence } from './live-presence'

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
const HIDDEN_STEPS = new Set([7, 12])

// Mesma janela/lógica do /api/quiz/live-presence: considera "ao vivo" quem
// mandou um heartbeat _live_<step> nos últimos ~30s. Duplicado aqui (não
// importar de dentro de app/api) só pra decidir o pontinho verde na tabela
// de Últimos acessos.
const LIVE_WINDOW_MS = 30_000
function parseHeartbeatTs(v: string): number {
  let s = v.replace(' ', 'T')
  s = s.replace(/([+-]\d{2})$/, '$1:00')
  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}

// Mesma classificação do /api/quiz/init-session.ts (duplicada aqui pelo mesmo
// motivo do parseHeartbeatTs acima). Aplicada em cima de orders.client_user_agent,
// que já existia antes do rastreamento por sessão — cobre só quem chegou a criar
// um pedido (fatia menor que todo mundo que faz o quiz, mas cobre o histórico
// inteiro, não só daqui pra frente).
function detectDeviceFromUA(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/iPad|Tablet/i.test(ua)) return 'tablet'
  if (/Mobile|iPhone|Android/i.test(ua)) return 'mobile'
  return 'desktop'
}
function detectPlatformFromUA(ua: string): 'iOS' | 'Android' | 'Windows' | 'Mac' | 'Other' {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Macintosh/i.test(ua)) return 'Mac'
  return 'Other'
}

// Ordem em que a pessoa realmente responde o quiz (chave de dado, não o
// número da URL — ver VISIBLE_ORDER em src/app/quiz/[step]/page.tsx). A
// numeração step_N é fixa por componente e não reflete mais a ordem de
// visita. Atualizada em 22/07 pra bater com o reorder que tornou o Step5Physical
// (dados físicos) a entrada do quiz: URL 5 vira 1º, URL 11 (obstáculos) vira 9º.
// step_7 (país, oculto) é salvo junto do step 6 (atividade), por isso entra logo
// depois dele aqui, mesmo não fazendo parte do VISIBLE_ORDER (não tem URL própria).
// Atualizar aqui se a ordem do quiz mudar de novo.
const VISIT_ORDER = [5, 1, 2, 6, 7, 4, 8, 9, 10, 11, 13, 12]

const OFFER_LABELS: Record<string, string> = {
  PLAN_BASIC: 'Só o plano · 7 dias',
  PLAN_RECIPES: 'Plano + 28 Receitas Fitness',
  PLAN_TRAINING: 'Plano + Receitas + Treino',
  PLAN_STANDARD: 'Plano Standard (legado)',
  TRAINING_BUMP: 'Bump Treino (legado)',
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

async function getFunnelData(sinceDate: string) {
  const supabase = createServiceClient()

  // "sinceDate" é só a data (YYYY-MM-DD, calculada em America/Sao_Paulo).
  // Sem a hora/fuso explícitos, o Postgres interpretava como meia-noite UTC,
  // que é 21h da noite anterior em Brasília — por isso "Hoje" já vinha com
  // horas de "ontem" contadas. Ancora explicitamente em meia-noite de Brasília.
  const since = sinceDate ? `${sinceDate}T00:00:00-03:00` : sinceDate

  let query = supabase
    .from('generation_sessions')
    .select('draft_answers, created_at')
    .order('created_at', { ascending: false })

  if (since) query = query.gte('created_at', since)

  // Order fabricado pra criar a conta de teste usada na revisão externa da
  // Hotmart (login-hotmart) — não é venda real, excluído das métricas do
  // funil. Mantido no banco (não apagar) enquanto a Hotmart não aprovar,
  // senão quebra o login dela.
  const HOTMART_REVIEWER_ORDER_ID = 'f8e9178f-69ca-4768-95c1-e5c8b3e65259'

  const [{ data, error }, { data: ordersRows }, { data: recentSalesRows }, { data: lastStartsRows }] = await Promise.all([
    query,
    supabase
      .from('orders')
      .select('session_id, status, order_items(product_code)')
      .gte('created_at', since)
      .neq('id', HOTMART_REVIEWER_ORDER_ID),
    supabase
      .from('orders')
      .select(`
        id, status, total_amount, currency, created_at, paid_at, client_user_agent,
        order_items(product_code),
        generation_sessions(draft_answers),
        users(name, email)
      `)
      .gte('created_at', since)
      .neq('id', HOTMART_REVIEWER_ORDER_ID)
      .order('created_at', { ascending: false })
      .limit(20),
    // Últimos acessos que começaram o quiz — sem filtro de "since", sempre os
    // 3 mais recentes de verdade (é um "pulso" de monitoramento ao vivo).
    supabase
      .from('generation_sessions')
      .select('id, created_at, draft_answers')
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  if (error || !data) return null

  // Conta SESSÕES distintas que iniciaram checkout, não linhas de order.
  // Um order é criado por tier clicado (idempotency = sessionId-plan_type),
  // então a mesma pessoa comparando 2 tiers gera 2 orders. Deduplicar por
  // session_id reflete pessoas, não cliques repetidos.
  const sessionIdsWithOrder = new Set((ordersRows ?? []).map((o) => o.session_id))
  const ordersCount = sessionIdsWithOrder.size

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
  // Dispositivo e plataforma (_device/_platform, capturados do user-agent no
  // init-session). Sessões de antes dessa captura existir (22/07) caem em "Sin dato".
  const deviceCounts: Record<string, number> = {}
  const platformCounts: Record<string, number> = {}
  for (const r of data) {
    const draft = (r.draft_answers ?? {}) as Record<string, unknown>
    const s7 = (draft.step_7 ?? {}) as { country?: string; country_detail?: string }
    const country = s7.country_detail ?? s7.country ?? (draft._detected_country as string | undefined) ?? 'Sin dato'
    countryCounts[country] = (countryCounts[country] ?? 0) + 1

    const adRef = (draft._ad_ref as string | undefined) ?? 'Sin dato'
    adRefCounts[adRef] = (adRefCounts[adRef] ?? 0) + 1

    const device = (draft._device as string | undefined) ?? 'Sin dato'
    deviceCounts[device] = (deviceCounts[device] ?? 0) + 1

    const platform = (draft._platform as string | undefined) ?? 'Sin dato'
    platformCounts[platform] = (platformCounts[platform] ?? 0) + 1
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
      client_user_agent: string | null
      order_items?: { product_code: string }[]
      generation_sessions?: { draft_answers?: Record<string, unknown> } | null
      users?: { name: string | null; email: string } | null
    }
    const draft = row.generation_sessions?.draft_answers ?? {}
    const step7 = (draft.step_7 ?? {}) as { country?: string; country_detail?: string }
    const ua = row.client_user_agent ?? ''
    return {
      id: row.id,
      status: row.status,
      totalAmount: row.total_amount,
      currency: row.currency,
      createdAt: row.created_at,
      productCode: row.order_items?.[0]?.product_code ?? 'Sin ítem',
      country: step7.country_detail ?? step7.country ?? (draft._detected_country as string | undefined) ?? '—',
      adRef: (draft._ad_ref as string | undefined) ?? '—',
      buyerName: row.users?.name ?? null,
      buyerEmail: row.users?.email ?? null,
      device: ua ? detectDeviceFromUA(ua) : null,
      platform: ua ? detectPlatformFromUA(ua) : null,
    }
  })

  // Dispositivo/sistema de quem chegou no checkout, via orders.client_user_agent
  // (já existia antes de hoje, ao contrário do _device/_platform por sessão de
  // quiz). Cobre só os pedidos listados acima (mesmo limite/período da tabela
  // "Vendas recentes"), não o funil inteiro.
  const checkoutDeviceCounts: Record<string, number> = {}
  const checkoutPlatformCounts: Record<string, number> = {}
  for (const sale of recentSales) {
    const device = sale.device ?? 'Sin dato'
    checkoutDeviceCounts[device] = (checkoutDeviceCounts[device] ?? 0) + 1
    const platform = sale.platform ?? 'Sin dato'
    checkoutPlatformCounts[platform] = (checkoutPlatformCounts[platform] ?? 0) + 1
  }

  // Últimos acessos que começaram o quiz, com a hora exata (Brasília) da entrada.
  // "lastStep" = até onde a pessoa avançou: primeiro checa se passou do quiz
  // (chegou na preview/oferta), senão percorre VISIT_ORDER de trás pra frente
  // achando o último step_N respondido.
  const lastStarts = (lastStartsRows ?? []).map((r) => {
    const draft = (r.draft_answers ?? {}) as Record<string, unknown>
    const s7 = (draft.step_7 ?? {}) as { country?: string; country_detail?: string }

    let lastStep = 'Não iniciou'
    let stepNum: number | null = null
    // Foi pra Hotmart tem prioridade sobre qualquer evento de visualização —
    // é o sinal mais forte de todos (clicou pra pagar), mesmo que o evento
    // de "viu toda a oferta" também tenha disparado.
    if (sessionIdsWithOrder.has(r.id)) { lastStep = 'Foi pra Hotmart'; stepNum = VISIT_ORDER.length }
    else if (hasEvent(r, '_ev_page_end')) { lastStep = 'Viu toda a oferta'; stepNum = VISIT_ORDER.length }
    else if (hasEvent(r, '_ev_tiers_reached')) { lastStep = 'Viu os planos'; stepNum = VISIT_ORDER.length }
    else if (hasEvent(r, '_ev_offer_reached')) { lastStep = 'Viu a oferta'; stepNum = VISIT_ORDER.length }
    else if (hasEvent(r, '_ev_preview_viewed')) { lastStep = 'Entrou na preview'; stepNum = VISIT_ORDER.length }
    else {
      for (let i = VISIT_ORDER.length - 1; i >= 0; i--) {
        const step = VISIT_ORDER[i]
        if (`step_${step}` in draft) { lastStep = STEP_LABELS[step] ?? `Step ${step}`; stepNum = i + 1; break }
      }
    }

    // "Ao vivo": mandou heartbeat _live_<step> dentro da janela de presença.
    let isLive = false
    for (const [k, v] of Object.entries(draft)) {
      if (!k.startsWith('_live_')) continue
      if (Date.now() - parseHeartbeatTs(String(v)) <= LIVE_WINDOW_MS) { isLive = true; break }
    }

    return {
      id: r.id,
      createdAt: r.created_at,
      adRef: (draft._ad_ref as string | undefined) ?? '—',
      country: s7.country_detail ?? s7.country ?? (draft._detected_country as string | undefined) ?? '—',
      lastStep,
      stepNum,
      isLive,
    }
  })

  return { total, stepCounts, previewViewed, offerReached, tiersReached, pageEnd, ordersCount: ordersCount ?? 0, countryCounts, offerCounts, recentSales, adRefCounts, deviceCounts, platformCounts, checkoutDeviceCounts, checkoutPlatformCounts, lastStarts }
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

  const { total, stepCounts, previewViewed, offerReached, tiersReached, pageEnd, ordersCount, countryCounts, offerCounts, recentSales, adRefCounts, deviceCounts, platformCounts, checkoutDeviceCounts, checkoutPlatformCounts, lastStarts } = data
  const firstStepCount = stepCounts[VISIT_ORDER[0]] || 1
  const countryRows = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])
  const offerRows = Object.entries(offerCounts).sort((a, b) => b[1].total - a[1].total)
  const adRefRows = Object.entries(adRefCounts).sort((a, b) => b[1] - a[1])
  const deviceLabels: Record<string, string> = { mobile: 'Celular', tablet: 'Tablet', desktop: 'Computador' }
  const deviceRows = Object.entries(deviceCounts).sort((a, b) => b[1] - a[1])
  const platformLabels: Record<string, string> = { iOS: 'iPhone/iPad', Android: 'Android', Windows: 'Windows', Mac: 'Mac', Other: 'Otro' }
  const platformRows = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])
  const checkoutDeviceRows = Object.entries(checkoutDeviceCounts).sort((a, b) => b[1] - a[1])
  const checkoutPlatformRows = Object.entries(checkoutPlatformCounts).sort((a, b) => b[1] - a[1])

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

      {/* Presença ao vivo — quantas pessoas estão no quiz AGORA, por etapa.
          Client component com polling; some sozinho quando a pessoa sai. */}
      <LivePresence />

      {/* Últimos acessos — hora exata (Brasília) que as 3 sessões mais recentes
          começaram o quiz, sem filtro de período (pulso de monitoramento ao vivo) */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <div className="border-b border-border bg-muted/50 px-4 py-3">
          <p className="text-sm font-semibold">Últimos acessos</p>
          <p className="text-xs text-muted-foreground">Hora exata (Brasília) que as 3 sessões mais recentes começaram o quiz</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase text-muted-foreground">
              <th className="px-4 py-1.5 font-medium">Hora</th>
              <th className="px-4 py-1.5 font-medium">Criativo</th>
              <th className="px-4 py-1.5 font-medium">País</th>
              <th className="px-4 py-1.5 font-medium">Parou em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lastStarts.length === 0 && (
              <tr><td className="px-4 py-3 text-muted-foreground">Sem sessões registradas.</td></tr>
            )}
            {lastStarts.map((s) => (
              <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs tabular-nums">
                  {new Date(s.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
                    timeZone: 'America/Sao_Paulo',
                  })}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.adRef}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.country}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    {s.isLive && (
                      <span className="flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                        Ao vivo
                      </span>
                    )}
                    <span>
                      {s.stepNum !== null && <span className="mr-1 font-mono text-[10px] text-muted-foreground/70">{s.stepNum}·</span>}
                      {s.lastStep}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
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
            {VISIT_ORDER.map((step, idx) => {
              const isHidden = HIDDEN_STEPS.has(step)
              const count = stepCounts[step] ?? 0
              const prev = idx === 0 ? firstStepCount : (stepCounts[VISIT_ORDER[idx - 1]] ?? 0)
              const pctStart = firstStepCount > 0 ? Math.round((count / firstStepCount) * 100) : 0
              const dropPct = prev > 0 ? Math.round(((prev - count) / prev) * 100) : 0
              const isHighDrop = !isHidden && dropPct >= 20

              return (
                <tr key={step} className={['transition-colors', isHidden ? 'opacity-40' : 'hover:bg-muted/30'].join(' ')}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {idx + 1}
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
                    {idx === 0 || isHidden ? (
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
              const pctStart = firstStepCount > 0 ? Math.round((count / firstStepCount) * 100) : 0
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
              const pctStart = firstStepCount > 0 ? Math.round((count / firstStepCount) * 100) : 0
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
              const pctStart = firstStepCount > 0 ? Math.round((count / firstStepCount) * 100) : 0
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
              const pctStart = firstStepCount > 0 ? Math.round((count / firstStepCount) * 100) : 0
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
              const pctStart = firstStepCount > 0 ? Math.round((count / firstStepCount) * 100) : 0
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
      <div className="overflow-x-auto rounded-xl border border-border">
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
              <th className="px-4 py-2 font-medium">Dispositivo</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recentSales.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-3 text-muted-foreground">Sin ventas en el período.</td></tr>
            )}
            {recentSales.map((s) => (
              <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(s.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
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
                <td className="px-4 py-2.5 text-xs">
                  {s.platform ? (platformLabels[s.platform] ?? s.platform) : (s.device ? (deviceLabels[s.device] ?? s.device) : '—')}
                </td>
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
      <div className="overflow-x-auto rounded-xl border border-border">
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
      <div className="overflow-x-auto rounded-xl border border-border">
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
      <div className="overflow-x-auto rounded-xl border border-border">
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

      {/* Dispositivos — user-agent classificado no init-session (_device).
          Sessões antes de 22/07 não têm essa chave, caem em "Sin dato". */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <div className="border-b border-border bg-muted/50 px-4 py-3">
          <p className="text-sm font-semibold">Dispositivos</p>
          <p className="text-xs text-muted-foreground">Classificado pelo user-agent na entrada do quiz (celular, tablet ou computador)</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {deviceRows.length === 0 && (
              <tr><td className="px-4 py-3 text-muted-foreground">Sem sessões no período.</td></tr>
            )}
            {deviceRows.map(([device, count]) => (
              <tr key={device} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 text-xs">{deviceLabels[device] ?? device}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{count}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                  {total > 0 ? Math.round((count / total) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sistema — iOS vs Android vs desktop, classificado pelo user-agent
          (_platform). É o dado que mais interessa pra decidir prioridade de
          teste/otimização por plataforma. */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <div className="border-b border-border bg-muted/50 px-4 py-3">
          <p className="text-sm font-semibold">Sistema</p>
          <p className="text-xs text-muted-foreground">iPhone/iPad vs Android vs computador, classificado pelo user-agent</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {platformRows.length === 0 && (
              <tr><td className="px-4 py-3 text-muted-foreground">Sem sessões no período.</td></tr>
            )}
            {platformRows.map(([platform, count]) => (
              <tr key={platform} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 text-xs">{platformLabels[platform] ?? platform}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{count}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                  {total > 0 ? Math.round((count / total) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Checkout — dispositivo/sistema de quem chegou a criar um pedido, via
          orders.client_user_agent (existia antes de hoje, cobre o histórico
          inteiro, mas só essa fatia final do funil — ver comentário na query). */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <div className="border-b border-border bg-muted/50 px-4 py-3">
          <p className="text-sm font-semibold">Checkout — dispositivo</p>
          <p className="text-xs text-muted-foreground">Solo de quien llegó a crear un pedido (últimas 20 ventas), no de todo el quiz</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {checkoutDeviceRows.length === 0 && (
              <tr><td className="px-4 py-3 text-muted-foreground">Sin pedidos en el período.</td></tr>
            )}
            {checkoutDeviceRows.map(([device, count]) => (
              <tr key={device} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 text-xs">{deviceLabels[device] ?? device}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{count}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                  {recentSales.length > 0 ? Math.round((count / recentSales.length) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <div className="border-b border-border bg-muted/50 px-4 py-3">
          <p className="text-sm font-semibold">Checkout — sistema</p>
          <p className="text-xs text-muted-foreground">iPhone/iPad vs Android vs computador, solo de quien llegó a crear un pedido</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {checkoutPlatformRows.length === 0 && (
              <tr><td className="px-4 py-3 text-muted-foreground">Sin pedidos en el período.</td></tr>
            )}
            {checkoutPlatformRows.map(([platform, count]) => (
              <tr key={platform} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 text-xs">{platformLabels[platform] ?? platform}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{count}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                  {recentSales.length > 0 ? Math.round((count / recentSales.length) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
