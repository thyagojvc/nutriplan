'use client'

import { useEffect, useState } from 'react'

// Rótulos por ETAPA VISÍVEL (posição no fluxo que a pessoa realmente vê),
// alinhados ao VISIBLE_ORDER do quiz (src/app/quiz/[step]/page.tsx).
// Atualizado em 15/07 pra bater com o reorder obstáculo-primeiro.
const VISIBLE_STEP_LABELS: Record<number, string> = {
  1: 'Obstáculos',
  2: 'Objetivo',
  3: 'Alimentos favoritos',
  4: 'Sexo',
  5: 'Nível de atividade',
  6: 'Restrições',
  7: 'Saúde',
  8: 'Exercício',
  9: 'Dados físicos',
  10: 'Incômodo corporal',
  11: 'Ponte emocional',
  12: 'Vendo o plano (preview)',
}

interface LiveSession {
  step: number
  country: string
  adRef: string | null
}

interface LiveData {
  total: number
  counts: Record<string, number>
  sessions: LiveSession[]
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
  const sessions = data?.sessions ?? []

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
              {sessions.map((s, i) => (
                <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{s.step}</span>
                    {VISIBLE_STEP_LABELS[s.step] ?? `Etapa ${s.step}`}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {s.adRef && <span className="max-w-[120px] truncate" title={s.adRef}>{s.adRef}</span>}
                    <span className="rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700">
                      {s.country}
                    </span>
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
