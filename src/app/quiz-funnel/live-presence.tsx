'use client'

import { useEffect, useState } from 'react'

// Rótulos por ETAPA VISÍVEL (posição no fluxo que a pessoa realmente vê),
// alinhados ao VISIBLE_ORDER do quiz (src/app/quiz/[step]/page.tsx).
const VISIBLE_STEP_LABELS: Record<number, string> = {
  1: 'Objetivo',
  2: 'Sexo',
  3: 'Alimentos favoritos',
  4: 'Dados físicos',
  5: 'Nível de atividade',
  6: 'Restrições',
  7: 'Saúde',
  8: 'Exercício',
  9: 'Obstáculos',
  10: 'Incômodo corporal',
  11: 'Ponte emocional',
}

interface LiveData {
  total: number
  counts: Record<string, number>
}

export function LivePresence() {
  const [data, setData] = useState<LiveData | null>(null)
  const [stale, setStale] = useState(false)

  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const res = await fetch('/api/quiz/live-presence', { cache: 'no-store' })
        const json = (await res.json()) as LiveData
        if (alive) { setData(json); setStale(false) }
      } catch {
        if (alive) setStale(true)
      }
    }
    poll()
    const iv = setInterval(poll, 5000)
    return () => { alive = false; clearInterval(iv) }
  }, [])

  const total = data?.total ?? 0
  const rows = Object.entries(data?.counts ?? {})
    .map(([step, n]) => ({ step: Number(step), n }))
    .sort((a, b) => a.step - b.step)

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={[
            'inline-block h-2.5 w-2.5 rounded-full',
            total > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-300',
          ].join(' ')} />
          <p className="text-sm font-semibold">Ao vivo agora</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {data === null ? 'carregando…' : stale ? 'reconectando…' : 'atualiza a cada 5s'}
        </p>
      </div>

      <div className="px-4 py-3">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            {data === null ? '—' : 'Ninguém no quiz neste momento.'}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">
              <strong className="tabular-nums">{total}</strong>{' '}
              {total === 1 ? 'pessoa' : 'pessoas'} no quiz agora
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {rows.map(({ step, n }) => (
                <li key={step} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{step}</span>
                    {VISIBLE_STEP_LABELS[step] ?? `Etapa ${step}`}
                  </span>
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                    {n} {n === 1 ? 'pessoa' : 'pessoas'} aqui
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
