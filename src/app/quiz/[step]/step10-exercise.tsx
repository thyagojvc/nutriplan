'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizOption, QuizChip, QuizSection, QuizCta, QuizError } from './quiz-ui'

const EXPERIENCE_OPTS = [
  { id: 'no_ejercicio', label: 'No hago ejercicio',  desc: 'No tengo ninguna rutina de actividad física', emoji: '📱' },
  { id: 'principiante', label: 'Principiante',        desc: 'Poca o ninguna experiencia',                  emoji: '🌱' },
  { id: 'intermedio',   label: 'Intermedio',          desc: 'Llevo algunos meses entrenando',              emoji: '🏋️' },
  { id: 'avanzado',     label: 'Avanzado',            desc: 'Entreno consistentemente hace años',          emoji: '🏆' },
]

const LOCATION_OPTS = [
  { id: 'casa',        label: 'En casa',       emoji: '🏠' },
  { id: 'gimnasio',    label: 'Gimnasio',      emoji: '🏋️' },
  { id: 'aire_libre',  label: 'Al aire libre', emoji: '🌳' },
]

const FREQUENCY_OPTS = [
  { id: '1_2',  label: '1–2 días/sem.' },
  { id: '3_4',  label: '3–4 días/sem.' },
  { id: '5_mas',label: '5+ días/sem.'  },
]

const LIMITATION_OPTS = [
  { id: 'ninguna',   label: 'Sin limitaciones', emoji: '✅' },
  { id: 'rodillas',  label: 'Rodillas',          emoji: '🦵' },
  { id: 'espalda',   label: 'Espalda',           emoji: '🦴' },
  { id: 'hombros',   label: 'Hombros',           emoji: '💪' },
  { id: 'cadera',    label: 'Cadera',            emoji: '🦴' },
  { id: 'cuello',    label: 'Cuello',            emoji: '🧣' },
  { id: 'otra',      label: 'Otra',              emoji: '📋' },
]

interface ExerciseData {
  experience: string | null
  location: string | null
  frequency: string | null
  limitations: string[]
}

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step10Exercise({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [data, setData] = useState<ExerciseData>(() => {
    if (typeof window === 'undefined') {
      return { experience: null, location: null, frequency: null, limitations: [] }
    }
    try {
      const cached = sessionStorage.getItem('nutriplan_step_10')
      const parsed = cached ? (JSON.parse(cached) as Partial<ExerciseData>) : {}
      return {
        experience: parsed.experience ?? null,
        location: parsed.location ?? null,
        frequency: parsed.frequency ?? null,
        limitations: parsed.limitations ?? [],
      }
    } catch { return { experience: null, location: null, frequency: null, limitations: [] } }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function setField<K extends keyof ExerciseData>(field: K, value: ExerciseData[K]) {
    const next = { ...data, [field]: value }
    if (field === 'experience' && value === 'no_ejercicio') {
      next.location = null
      next.frequency = null
    }
    setData(next)
    sessionStorage.setItem('nutriplan_step_10', JSON.stringify(next))
  }

  function toggleLimitation(id: string) {
    let next: string[]
    if (id === 'ninguna') {
      next = data.limitations.includes('ninguna') ? [] : ['ninguna']
    } else {
      const without = data.limitations.filter((x) => x !== 'ninguna')
      next = without.includes(id) ? without.filter((x) => x !== id) : [...without, id]
    }
    const updated = { ...data, limitations: next }
    setData(updated)
    sessionStorage.setItem('nutriplan_step_10', JSON.stringify(updated))
    // "Sin limitaciones" avanza solo, pero solo si el resto del paso ya está completo
    const restValid = updated.experience === 'no_ejercicio'
      ? !!updated.experience
      : !!updated.experience && !!updated.location && !!updated.frequency
    if (id === 'ninguna' && next.includes('ninguna') && restValid) submit(updated)
  }

  const noExercise = data.experience === 'no_ejercicio'
  const isValid = noExercise
    ? !!data.experience && data.limitations.length > 0
    : !!data.experience && !!data.location && !!data.frequency && data.limitations.length > 0

  async function submit(payload: ExerciseData) {
    const valid = payload.experience === 'no_ejercicio'
      ? !!payload.experience && payload.limitations.length > 0
      : !!payload.experience && !!payload.location && !!payload.frequency && payload.limitations.length > 0
    if (!valid || saving) return
    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 10, answers: payload }),
      })
      if (!res.ok) { setError(true); setSaving(false); return }
      router.push('/quiz/11')
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  const handleContinue = () => submit(data)

  const progress = Math.round((stepNumber / totalSteps) * 100)

  return (
    <QuizLayout>
      <QuizProgress step={stepNumber} total={totalSteps} pct={progress} />

      <QuizCard>
        <QuizHeader title="Cuéntanos sobre tu ejercicio" />

        {/* Experiencia */}
        <QuizSection title="Experiencia en entrenamiento">
          <div className="space-y-2">
            {EXPERIENCE_OPTS.map(({ id, label, desc, emoji }) => (
              <QuizOption
                key={id}
                label={label}
                desc={desc}
                emoji={emoji}
                selected={data.experience === id}
                onSelect={() => setField('experience', id)}
              />
            ))}
          </div>
        </QuizSection>

        {/* Lugar e Frequência */}
        {!noExercise && (
          <>
            <QuizSection title="¿Dónde entrenas?">
              <div className="grid grid-cols-3 gap-2">
                {LOCATION_OPTS.map(({ id, label, emoji }) => (
                  <QuizChip
                    key={id}
                    label={label}
                    emoji={emoji}
                    selected={data.location === id}
                    onToggle={() => setField('location', id)}
                  />
                ))}
              </div>
            </QuizSection>

            <QuizSection title="¿Con qué frecuencia?">
              <div className="grid grid-cols-3 gap-2">
                {FREQUENCY_OPTS.map(({ id, label }) => (
                  <QuizChip
                    key={id}
                    label={label}
                    selected={data.frequency === id}
                    onToggle={() => setField('frequency', id)}
                  />
                ))}
              </div>
            </QuizSection>
          </>
        )}

        {/* Limitaciones */}
        <QuizSection title="Limitaciones musculoesqueléticas">
          <div className="space-y-2">
            <QuizChip
              label="Sin limitaciones"
              emoji="✅"
              selected={data.limitations.includes('ninguna')}
              onToggle={() => toggleLimitation('ninguna')}
              fullWidth
            />
            <div className="grid grid-cols-2 gap-2">
              {LIMITATION_OPTS.filter(o => o.id !== 'ninguna').map(({ id, label, emoji }) => (
                <QuizChip
                  key={id}
                  label={label}
                  emoji={emoji}
                  selected={data.limitations.includes(id)}
                  onToggle={() => toggleLimitation(id)}
                />
              ))}
            </div>
          </div>
        </QuizSection>

        {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
      </QuizCard>

      <QuizCta onClick={handleContinue} disabled={!isValid} loading={saving} />
    </QuizLayout>
  )
}
