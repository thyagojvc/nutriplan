'use client'

import { useState } from 'react'
import { Dumbbell, Check, Download } from 'lucide-react'
import type { TrainingPlanJson } from '@/lib/nutrition/generate'
import { SectionTitle } from '../dashboard-ui'

const BENEFITS = [
  'Rutina armada según tu experiencia, tu lugar de entrenamiento y tu frecuencia real',
  'Series y repeticiones adaptadas a tu objetivo (perder grasa, ganar músculo o mantener)',
  'Mismo formato simple del plan de comidas: entrás y ya sabés qué hacer hoy',
  'PDF descargable para llevarlo al gimnasio o a donde entrenes',
]

// sck (usado pela Hotmart pra casar a compra ao pedido existente) precisa
// respeitar se a URL do produto já tem query string própria (ex: ?off=xxx).
function withSck(url: string, orderId: string): string {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}sck=${orderId}`
}

export function TrainingTab({
  trainingPlan,
  trainingPdfHref,
  checkoutUrl,
  orderId,
}: {
  trainingPlan: TrainingPlanJson | null
  trainingPdfHref?: string
  checkoutUrl?: string
  orderId: string
}) {
  const [activeDay, setActiveDay] = useState(0)

  if (!trainingPlan) {
    return (
      <div className="space-y-5">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Dumbbell className="h-7 w-7 text-primary" strokeWidth={2.2} />
          </div>
          <h2 className="font-display text-[20px] font-black text-foreground [text-wrap:balance]">
            Añade tu plan de entrenamiento
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            La misma calibración de tu plan de comidas, aplicada a un plan de ejercicio hecho para tu cuerpo.
          </p>
        </div>

        <ul className="space-y-2.5 rounded-2xl border border-[#D8E8D4] bg-white p-4">
          {BENEFITS.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {checkoutUrl && (
          <a
            href={withSck(checkoutUrl, orderId)}
            className="flex flex-col items-center gap-0.5 rounded-xl bg-primary px-4 py-3.5 text-center shadow-[0_4px_20px_rgba(15,110,86,0.28)] hover:brightness-105 active:scale-[0.98] transition-all"
          >
            <span className="text-sm font-black text-white">Agregar por $4.90 →</span>
            <span className="text-[11px] font-medium text-white/80">Pago único, acceso inmediato</span>
          </a>
        )}
      </div>
    )
  }

  const day = trainingPlan.days[activeDay]

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <SectionTitle>Tu plan de entrenamiento</SectionTitle>
        <p className="text-xs text-muted-foreground">{trainingPlan.summary.notes[0]}</p>
      </div>

      {trainingPdfHref && (
        <a
          href={trainingPdfHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          <Download className="h-4 w-4" strokeWidth={2.4} />
          Descargar en PDF
        </a>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {trainingPlan.days.map((d, i) => (
          <button
            key={i}
            onClick={() => setActiveDay(i)}
            className={[
              'shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-all',
              i === activeDay
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/70',
            ].join(' ')}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-foreground">{day.focus}</p>
        <div className="space-y-2">
          {day.exercises.map((ex, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <span className="text-sm font-medium">{ex.name}</span>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{ex.sets}</span>
            </div>
          ))}
        </div>
      </div>

      {trainingPlan.disclaimers.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          {trainingPlan.disclaimers.map((d, i) => <p key={i}>{d}</p>)}
        </div>
      )}
    </div>
  )
}
