'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizOption, QuizCta, QuizError } from './quiz-ui'

const GOAL_LABEL: Record<string, string> = {
  perder_peso: 'perder peso',
  mantener: 'mantener tu peso',
  ganar_masa: 'ganar masa muscular',
}

const PRICED_COUNTRIES = new Set(['MX', 'CO', 'CL', 'ES'])

function toDbCountry(code: string | undefined): string {
  return code && PRICED_COUNTRIES.has(code) ? code : 'OTHER'
}

// Descripciones sobre la RUTINA DIARIA (trabajo, movimiento cotidiano), no
// sobre entrenamiento estructurado — eso se pregunta aparte en el step de
// ejercicio, para no sonar como la misma pregunta repetida dos veces.
const LEVELS = [
  { id: 'sedentario',            factor: 1.2,   label: 'Sedentario',               desc: 'Trabajo de oficina, mayormente sentada todo el día',            emoji: '🛋️' },
  { id: 'ligeramente_activo',    factor: 1.375, label: 'Ligeramente activo',        desc: 'Te mueves bastante: caminas, subes escaleras, trabajo de pie',  emoji: '🚶' },
  { id: 'moderadamente_activo',  factor: 1.55,  label: 'Moderadamente activo',      desc: 'Tu día es físicamente exigente, con movimiento constante',      emoji: '🏃' },
  { id: 'muy_activo',            factor: 1.725, label: 'Muy activo',                desc: 'Trabajo físico intenso (cargar peso, de pie todo el día)',      emoji: '⚡' },
]

interface Props {
  stepNumber: number
  totalSteps: number
  detectedCountry?: string
}

export function Step6Activity({ stepNumber, totalSteps, detectedCountry }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem('nutriplan_step_6')
      const parsed = cached ? (JSON.parse(cached) as { activity_level?: string }) : {}
      return parsed.activity_level ?? null
    } catch { return null }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  // Confirma o objetivo (respondido no passo anterior) antes da pergunta atual.
  const [goal] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem('nutriplan_step_2')
      const parsed = cached ? (JSON.parse(cached) as { goal?: string }) : {}
      return parsed.goal ?? null
    } catch { return null }
  })

  function handleSelect(id: string) {
    const level = LEVELS.find((l) => l.id === id)!
    setSelected(id)
    // sessionStorage pode falhar (ex: navegador interno do Instagram/Facebook
    // com armazenamento restrito) — não pode bloquear o avanço se isso acontecer.
    try {
      sessionStorage.setItem('nutriplan_step_6', JSON.stringify({ activity_level: id, activity_factor: level.factor }))
    } catch { /* segue sem cache local; o save-step ainda persiste no banco */ }
    // Escolha única: avança direto, sem exigir o clique em Continuar
    submit(id)
  }

  async function submit(activityLevel: string) {
    if (!activityLevel || saving) return
    const level = LEVELS.find((l) => l.id === activityLevel)!
    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 6, answers: { activity_level: activityLevel, activity_factor: level.factor } }),
      })
      if (!res.ok) { setError(true); setSaving(false); return }

      const dbCountry = toDbCountry(detectedCountry)
      try {
        sessionStorage.setItem('nutriplan_step_7', JSON.stringify({ country: dbCountry, country_detail: detectedCountry ?? null }))
      } catch { /* segue sem cache local; o save-step abaixo ainda persiste no banco */ }
      fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 7, answers: { country: dbCountry, country_detail: detectedCountry ?? null }, country: dbCountry }),
      }).catch(() => {})

      router.push('/quiz/4') // → sexo biológico
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  const handleContinue = () => { if (selected) submit(selected) }

  const progress = Math.round((stepNumber / totalSteps) * 100)

  return (
    <QuizLayout>
      <QuizProgress step={stepNumber} total={totalSteps} pct={progress} />

      <QuizCard>
        <QuizHeader
          confirm={goal ? `Objetivo registrado: ${GOAL_LABEL[goal] ?? goal}. Ahora, tu rutina diaria.` : undefined}
          title="¿Cómo es tu rutina diaria, más allá del ejercicio?"
          subtitle="Esto determina cuántas calorías necesitas cada día. Sobre tu entrenamiento te preguntamos más adelante."
        />

        <div className="space-y-2.5">
          {LEVELS.map(({ id, label, desc, emoji }) => (
            <QuizOption
              key={id}
              label={label}
              desc={desc}
              emoji={emoji}
              selected={selected === id}
              onSelect={() => handleSelect(id)}
            />
          ))}
        </div>

        {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
      </QuizCard>

      <QuizCta onClick={handleContinue} disabled={!selected} loading={saving} />
    </QuizLayout>
  )
}
