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
  12: 'Ponte emocional (CTA)',
}

// Steps ocultos (auto-save sem UI): excluídos da análise de abandono.
const HIDDEN_STEPS = new Set([7])

async function getFunnelData(since: string) {
  const supabase = createServiceClient()

  let query = supabase
    .from('generation_sessions')
    .select('draft_answers, created_at')
    .order('created_at', { ascending: false })

  if (since) query = query.gte('created_at', since)

  const [{ data, error }, { count: ordersCount }] = await Promise.all([
    query,
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since),
  ])

  if (error || !data) return null

  const total = data.length

  const stepCounts: Record<number, number> = {}
  for (let s = 1; s <= 12; s++) {
    stepCounts[s] = data.filter(
      (r) => r.draft_answers && typeof r.draft_answers === 'object' && `step_${s}` in r.draft_answers,
    ).length
  }

  const previewViewed = data.filter(
    (r) => r.draft_answers && typeof r.draft_answers === 'object' && '_ev_preview_viewed' in r.draft_answers,
  ).length

  return { total, stepCounts, previewViewed, ordersCount: ordersCount ?? 0 }
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

  const { total, stepCounts, previewViewed, ordersCount } = data
  const step1 = stepCounts[1] || 1

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
            {Array.from({ length: 12 }, (_, i) => i + 1).map((step) => {
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

            {/* Linha: Clicaram no Hotmart */}
            {(() => {
              const count = ordersCount
              const prev = previewViewed
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
    </div>
  )
}
