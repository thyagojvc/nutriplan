'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const EXPERIENCE_OPTS = [
  { id: 'no_ejercicio', label: 'No hago ejercicio', desc: 'No tengo ninguna rutina de actividad física' },
  { id: 'principiante', label: 'Principiante', desc: 'Poca o ninguna experiencia' },
  { id: 'intermedio', label: 'Intermedio', desc: 'Llevo algunos meses entrenando' },
  { id: 'avanzado', label: 'Avanzado', desc: 'Entreno consistentemente hace años' },
]

const LOCATION_OPTS = [
  { id: 'casa', label: 'En casa' },
  { id: 'gimnasio', label: 'Gimnasio' },
  { id: 'aire_libre', label: 'Al aire libre' },
]

const FREQUENCY_OPTS = [
  { id: '1_2', label: '1–2 días/sem.' },
  { id: '3_4', label: '3–4 días/sem.' },
  { id: '5_mas', label: '5+ días/sem.' },
]

const LIMITATION_OPTS = [
  { id: 'ninguna', label: 'Sin limitaciones' },
  { id: 'rodillas', label: 'Rodillas' },
  { id: 'espalda', label: 'Espalda' },
  { id: 'hombros', label: 'Hombros' },
  { id: 'cadera', label: 'Cadera' },
  { id: 'cuello', label: 'Cuello' },
  { id: 'otra', label: 'Otra' },
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
    } catch {
      return { experience: null, location: null, frequency: null, limitations: [] }
    }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function setField<K extends keyof ExerciseData>(field: K, value: ExerciseData[K]) {
    const next = { ...data, [field]: value }
    // Se selecionou "no hago ejercicio", limpar localização e frequência
    if (field === 'experience' && value === 'no_ejercicio') {
      next.location = null
      next.frequency = null
    }
    setData(next)
    sessionStorage.setItem('nutriplan_step_10', JSON.stringify(next))
  }

  function toggleLimitation(id: string) {
    setData((prev) => {
      let next: string[]
      if (id === 'ninguna') {
        next = prev.limitations.includes('ninguna') ? [] : ['ninguna']
      } else {
        const without = prev.limitations.filter((x) => x !== 'ninguna')
        next = without.includes(id) ? without.filter((x) => x !== id) : [...without, id]
      }
      const updated = { ...prev, limitations: next }
      sessionStorage.setItem('nutriplan_step_10', JSON.stringify(updated))
      return updated
    })
  }

  const noExercise = data.experience === 'no_ejercicio'
  const isValid = noExercise
    ? !!data.experience && data.limitations.length > 0
    : !!data.experience && !!data.location && !!data.frequency && data.limitations.length > 0

  async function handleContinue() {
    if (!isValid || saving) return
    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 10, answers: data }),
      })
      if (!res.ok) { setError(true); return }
      router.push('/quiz/11')
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const progress = Math.round((stepNumber / totalSteps) * 100)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 py-8">
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Paso {stepNumber} de {totalSteps}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border p-6 space-y-6">
          <h1 className="text-xl font-semibold">Cuéntanos sobre tu ejercicio</h1>

          {/* Experiencia */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Experiencia en entrenamiento</p>
            <div className="space-y-2">
              {EXPERIENCE_OPTS.map(({ id, label, desc }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setField('experience', id)}
                  className={[
                    'w-full rounded-lg border-2 px-4 py-2.5 text-left text-sm transition-colors',
                    data.experience === id
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-border hover:border-primary/50',
                  ].join(' ')}
                >
                  {label}
                  <span className="block text-xs text-muted-foreground font-normal">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Lugar e Frequência — só para quem treina */}
          {!noExercise && (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">¿Dónde entrenas?</p>
                <div className="grid grid-cols-3 gap-2">
                  {LOCATION_OPTS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setField('location', id)}
                      className={[
                        'rounded-lg border-2 px-2 py-2.5 text-center text-sm transition-colors',
                        data.location === id
                          ? 'border-primary bg-primary/5 font-medium'
                          : 'border-border hover:border-primary/50',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">¿Con qué frecuencia?</p>
                <div className="grid grid-cols-3 gap-2">
                  {FREQUENCY_OPTS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setField('frequency', id)}
                      className={[
                        'rounded-lg border-2 px-2 py-2.5 text-center text-xs transition-colors',
                        data.frequency === id
                          ? 'border-primary bg-primary/5 font-medium'
                          : 'border-border hover:border-primary/50',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Limitaciones */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Limitaciones musculoesqueléticas</p>
            <div className="grid grid-cols-2 gap-2">
              {LIMITATION_OPTS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleLimitation(id)}
                  className={[
                    'rounded-lg border-2 px-3 py-2 text-left text-sm transition-colors',
                    id === 'ninguna' ? 'col-span-2' : '',
                    data.limitations.includes(id)
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'border-border hover:border-primary/50',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">Error al guardar. Intenta de nuevo.</p>
          )}
        </div>

        <button
          onClick={handleContinue}
          disabled={!isValid || saving}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Continuar'}
        </button>
      </div>
    </main>
  )
}
