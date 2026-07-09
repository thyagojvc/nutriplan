'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { NutriLogo, NutriWordmark } from '@/app/quiz/[step]/quiz-ui'

const ACTIVITY_LABELS: Record<string, string> = {
  sedentario: 'sedentario',
  ligeramente_activo: 'ligeramente activo',
  moderadamente_activo: 'moderadamente activo',
  muy_activo: 'muy activo',
}

const GOAL_LABELS: Record<string, string> = {
  perder_peso: 'perder grasa',
  mantener: 'mantener tu peso',
  ganar_masa: 'ganar masa muscular',
}

// Frases genéricas — usadas no primeiro render (servidor e cliente, antes do
// useEffect rodar) pra manter o mesmo número de fases e evitar mismatch de
// hidratação, já que sessionStorage só existe no cliente.
const FALLBACK_PHASES = [
  'Analizando tus respuestas…',
  'Calculando tu metabolismo basal…',
  'Determinando tus calorías objetivo…',
  'Distribuyendo tus macronutrientes…',
  'Adaptando a tus restricciones alimentarias…',
  'Seleccionando tus alimentos favoritos…',
  'Armando tu plan de 7 días…',
  '¡Tu NutriPlan está listo!',
]

// Injeta os dados reais da sessão nas frases — reforça que o cálculo é
// personalizado de verdade, não uma animação genérica igual pra todo mundo.
function buildPersonalizedPhases(): string[] {
  let weightKg: number | undefined
  let goalLabel: string | undefined
  let activityLabel: string | undefined
  let likesCount = 0
  let restrictionsCount = 0

  try {
    const s5 = sessionStorage.getItem('nutriplan_step_5')
    if (s5) weightKg = (JSON.parse(s5) as { weight_kg?: number }).weight_kg

    const s2 = sessionStorage.getItem('nutriplan_step_2')
    if (s2) goalLabel = GOAL_LABELS[(JSON.parse(s2) as { goal?: string }).goal ?? '']

    const s6 = sessionStorage.getItem('nutriplan_step_6')
    if (s6) activityLabel = ACTIVITY_LABELS[(JSON.parse(s6) as { activity_level?: string }).activity_level ?? '']

    const s1 = sessionStorage.getItem('nutriplan_step_1')
    if (s1) likesCount = ((JSON.parse(s1) as { likes?: string[] }).likes ?? []).length

    const s8 = sessionStorage.getItem('nutriplan_step_8')
    if (s8) restrictionsCount = ((JSON.parse(s8) as { restrictions?: string[] }).restrictions ?? []).length
  } catch {
    return FALLBACK_PHASES
  }

  const metabolismoDetail = weightKg && activityLabel ? ` (${weightKg}kg · ${activityLabel})` : ''
  const caloriasDetail = goalLabel ? ` para ${goalLabel}` : ''
  const restriccionesDetail = restrictionsCount > 0 ? ` (${restrictionsCount} restricciones)` : ''
  const alimentosDetail = likesCount > 0 ? ` (${likesCount} alimentos)` : ''

  return [
    'Analizando tus respuestas…',
    `Calculando tu metabolismo basal${metabolismoDetail}…`,
    `Determinando tus calorías objetivo${caloriasDetail}…`,
    'Distribuyendo tus macronutrientes…',
    `Adaptando a tus restricciones alimentarias${restriccionesDetail}…`,
    `Seleccionando tus alimentos favoritos${alimentosDetail}…`,
    'Armando tu plan de 7 días…',
    '¡Tu NutriPlan está listo!',
  ]
}

const ANIMATION_MS = 15_000
const PHASE_DURATION = ANIMATION_MS / FALLBACK_PHASES.length

export default function CalculandoPage() {
  const router = useRouter()
  const [phases, setPhases] = useState<string[]>(FALLBACK_PHASES)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const done = useRef(false)

  // Troca pras frases personalizadas assim que montar no cliente (sessionStorage
  // não existe no servidor). Mesmo tamanho de array, então não muda o layout.
  useEffect(() => {
    setPhases(buildPersonalizedPhases())
  }, [])

  useEffect(() => {
    const start = Date.now()
    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min((elapsed / ANIMATION_MS) * 100, 100)
      setProgress(pct)
      setPhaseIndex(Math.min(Math.floor(elapsed / PHASE_DURATION), FALLBACK_PHASES.length - 1))
      if (elapsed >= ANIMATION_MS && !done.current) {
        done.current = true
        clearInterval(tick)
        router.push('/preview' as never)
      }
    }, 80)
    return () => clearInterval(tick)
  }, [router])

  const circumference = 2 * Math.PI * 34
  const isLast = phaseIndex === phases.length - 1

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        background:
          'linear-gradient(180deg, hsl(148,38%,90%) 0px, hsl(148,28%,95%) 90px, hsl(80,18%,97%) 220px)',
      }}
    >
      {/* Header de marca */}
      <header className="flex h-14 items-center justify-center border-b border-[#D4E8D0] bg-white/80 backdrop-blur-md">
        <NutriWordmark size="md" />
      </header>

      {/* Conteúdo central */}
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8 text-center">

          {/* Logo pulsando dentro do círculo de progresso */}
          <div className="flex justify-center">
            <div className="relative flex items-center justify-center">
              <svg className="w-36 h-36 -rotate-90" viewBox="0 0 80 80">
                {/* Trilho */}
                <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(148,18%,88%)" strokeWidth="5" />
                {/* Progresso */}
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke="hsl(148,52%,28%)" strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - progress / 100)}
                  style={{ transition: 'stroke-dashoffset 0.08s linear' }}
                />
              </svg>
              {/* Logo no centro */}
              <div className={[
                'absolute flex items-center justify-center transition-all duration-500',
                isLast ? 'scale-110' : 'scale-100',
              ].join(' ')}>
                <NutriLogo size={32} />
              </div>
            </div>
          </div>

          {/* Texto */}
          <div className="space-y-2">
            <h1 className="text-xl font-black text-gray-900">
              {isLast ? '¡Listo!' : 'Calibrando tu metabolismo'}
            </h1>
            <p
              key={phaseIndex}
              className="min-h-[1.5rem] text-sm font-semibold text-primary"
              style={{ animation: 'quiz-enter 0.3s ease-out both' }}
            >
              {phases[phaseIndex]}
            </p>
          </div>

          {/* Dots de fase */}
          <div className="flex justify-center gap-1.5">
            {phases.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === phaseIndex ? 20 : 6,
                  height: 6,
                  background: i <= phaseIndex ? 'hsl(148,52%,28%)' : 'hsl(148,18%,84%)',
                }}
              />
            ))}
          </div>

          {/* Barra linear */}
          <div className="space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'hsl(148,18%,88%)' }}>
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${progress}%`, transition: 'width 0.08s linear' }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Calibrando según tus respuestas — solo un momento…
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
