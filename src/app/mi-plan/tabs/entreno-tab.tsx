'use client'

// =============================================================================
// Aba "Entreno".
//
// Honestidade obrigatória aqui: o treino NÃO está incluído nos $9.90, é um
// acréscimo dentro do checkout. A rotina mostrada é a real, gerada com as
// respostas do passo 10 (experiência, lugar, frequência, limitações), então o
// cadeado promete exatamente o que ela recebe se somar.
//
// Quem respondeu que não treina não vê "faltou treinar": vê a versão de casa,
// que é o que o próprio gerador monta pra esse caso.
// =============================================================================

import type { TrainingPlanJson } from '@/lib/nutrition/generate'
import { Dumbbell, Check } from 'lucide-react'
import { SectionTitle } from '@/app/(dashboard)/dashboard/dashboard-ui'
import { LockedBlock } from '../lock-ui'

const BENEFITS = [
  'Armada con tu experiencia, tu lugar de entrenamiento y tu frecuencia real',
  'Series y repeticiones según tu objetivo, no una tabla igual para todas',
  'Mismo formato que tu plan de comidas: entras y ya sabes qué toca hoy',
  'Respeta las limitaciones físicas que marcaste',
]

export function EntrenoTab({
  trainingPlan,
  noTraining,
  onUnlock,
}: {
  trainingPlan: TrainingPlanJson | null
  /** Respondeu explicitamente que não faz exercício (passo 10). */
  noTraining: boolean
  onUnlock: (id: string) => void
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Dumbbell className="h-7 w-7 text-primary" strokeWidth={2.2} />
        </div>
        <h2 className="font-display text-[20px] font-black text-foreground [text-wrap:balance]">
          {noTraining
            ? 'También armamos tu rutina en casa'
            : 'Tu rutina también está armada'}
        </h2>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
          {noTraining
            ? 'Dijiste que hoy no entrenas, así que salió una versión para hacer en casa, sin equipo y sin depender del gimnasio.'
            : 'La misma calibración de tu plan de comidas, aplicada al ejercicio que ya haces.'}
        </p>
      </div>

      <ul className="space-y-2.5 rounded-2xl border border-[#D8E8D4] bg-white p-4">
        {BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm text-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {trainingPlan && (
        <section className="space-y-3">
          <SectionTitle>Así quedó la tuya</SectionTitle>
          <LockedBlock
            id="entreno"
            title={`${trainingPlan.days.length} sesiones, hechas con tus respuestas`}
            hint="Se suma dentro del checkout por $4.90. No está incluido en tu plan de comidas."
            onUnlock={onUnlock}
          >
            <div className="space-y-3 p-4">
              <div className="flex gap-1.5 overflow-hidden">
                {trainingPlan.days.map((d, i) => (
                  <span
                    key={i}
                    className={[
                      'shrink-0 rounded-xl px-3 py-2 text-xs font-semibold',
                      i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    ].join(' ')}
                  >
                    {d.label}
                  </span>
                ))}
              </div>
              <p className="text-sm font-bold text-foreground">{trainingPlan.days[0].focus}</p>
              <div className="space-y-2">
                {trainingPlan.days[0].exercises.map((ex, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                    <span className="text-sm font-medium">{ex.name}</span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                      {ex.sets}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </LockedBlock>
          <p className="text-center text-[12px] leading-snug text-muted-foreground">
            El entrenamiento es un extra opcional. Tu plan de comidas funciona solo, sin él.
          </p>
        </section>
      )}
    </div>
  )
}
