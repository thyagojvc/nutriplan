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

async function getFunnelData() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('generation_sessions')
    .select('draft_answers, created_at')
    .order('created_at', { ascending: false })

  if (error || !data) return null

  const total = data.length
  const last30 = data.filter(
    (r) => new Date(r.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  ).length

  const stepCounts: Record<number, number> = {}
  for (let s = 1; s <= 12; s++) {
    stepCounts[s] = data.filter(
      (r) => r.draft_answers && typeof r.draft_answers === 'object' && `step_${s}` in r.draft_answers,
    ).length
  }

  return { total, last30, stepCounts }
}

export default async function QuizFunnelPage() {
  const data = await getFunnelData()

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center text-muted-foreground">
        Erro ao carregar dados. Verifique a conexão com o Supabase.
      </div>
    )
  }

  const { total, last30, stepCounts } = data
  const step1 = stepCounts[1] || 1

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold">Funil do quiz</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sessões totais: <strong>{total}</strong> · Últimos 30 dias: <strong>{last30}</strong>
        </p>
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
              const count = stepCounts[step] ?? 0
              const prev = step === 1 ? step1 : (stepCounts[step - 1] ?? 0)
              const pctStart = step1 > 0 ? Math.round((count / step1) * 100) : 0
              const dropPct = prev > 0 ? Math.round(((prev - count) / prev) * 100) : 0
              const isHighDrop = dropPct >= 20

              return (
                <tr key={step} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {step}
                  </td>
                  <td className="px-4 py-3 font-medium">{STEP_LABELS[step]}</td>
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
                    {step === 1 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={[
                          'text-xs font-medium',
                          isHighDrop ? 'text-red-600' : 'text-muted-foreground',
                        ].join(' ')}
                      >
                        {isHighDrop ? '⚠ ' : ''}{dropPct}%
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Abandono ⚠ sinaliza steps com queda ≥ 20% em relação ao step anterior.
        Atualiza ao recarregar a página.
      </p>
    </div>
  )
}
