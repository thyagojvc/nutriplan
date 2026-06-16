'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const PHASES = [
  'Analizando tus respuestas…',
  'Calculando tu metabolismo basal…',
  'Determinando tus calorías objetivo…',
  'Distribuyendo tus macronutrientes…',
  'Adaptando a tus restricciones alimentarias…',
  'Seleccionando tus alimentos favoritos…',
  'Armando tu plan de 7 días…',
  '¡Tu plan personalizado está listo!',
]

const ANIMATION_MS = 20_000
const PHASE_DURATION = ANIMATION_MS / PHASES.length

export default function CalculandoPage() {
  const router = useRouter()
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const done = useRef(false)

  useEffect(() => {
    const start = Date.now()
    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min((elapsed / ANIMATION_MS) * 100, 100)
      setProgress(pct)
      setPhaseIndex(Math.min(Math.floor(elapsed / PHASE_DURATION), PHASES.length - 1))

      if (elapsed >= ANIMATION_MS && !done.current) {
        done.current = true
        clearInterval(tick)
        router.push('/checkout')
      }
    }, 80)
    return () => clearInterval(tick)
  }, [router])

  const circumference = 2 * Math.PI * 34

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-8 text-center">

        {/* Círculo de progresso */}
        <div className="flex justify-center">
          <svg className="w-32 h-32 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
            <circle
              cx="40" cy="40" r="34" fill="none"
              stroke="hsl(var(--primary))" strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress / 100)}
              style={{ transition: 'stroke-dashoffset 0.08s linear' }}
            />
          </svg>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold">Calculando tu plan</h1>
          <p className="text-sm text-primary font-medium min-h-[1.5rem]">
            {PHASES[phaseIndex]}
          </p>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2">
          {PHASES.map((_, i) => (
            <div
              key={i}
              className={[
                'h-2 w-2 rounded-full transition-all duration-300',
                i <= phaseIndex ? 'bg-primary scale-110' : 'bg-muted',
              ].join(' ')}
            />
          ))}
        </div>

        {/* Barra */}
        <div className="space-y-2">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${progress}%`, transition: 'width 0.08s linear' }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Personalizando según tus respuestas. Un momento…
          </p>
        </div>

      </div>
    </main>
  )
}
