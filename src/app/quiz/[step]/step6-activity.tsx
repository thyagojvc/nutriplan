'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizOption, QuizCta, QuizError } from './quiz-ui'
import { calcBMR } from '@/lib/nutrition/math'

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

  // Calcula o metabolismo basal com os dados dos passos anteriores (sexo +
  // dados físicos) e mostra o número real antes da próxima pergunta — mesma
  // matemática determinística do restante do produto (src/lib/nutrition/math.ts).
  const [bmr] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const sexCached = sessionStorage.getItem('nutriplan_step_4')
      const sex = (sexCached ? (JSON.parse(sexCached) as { sex?: string }).sex : null)
      const physCached = sessionStorage.getItem('nutriplan_step_5')
      const phys = physCached ? (JSON.parse(physCached) as { age?: number; weight_kg?: number; height_cm?: number }) : {}
      if (!sex || !phys.age || !phys.weight_kg || !phys.height_cm) return null
      return Math.round(calcBMR(sex === 'masculino' ? 'male' : 'female', phys.weight_kg, phys.height_cm, phys.age))
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

      router.push('/quiz/8')
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
          confirm={bmr ? `Tu Calibración Metabólica ya calculó tu metabolismo basal: ${bmr} kcal/día. Ahora tu rutina diaria.` : undefined}
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
