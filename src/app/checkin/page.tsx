'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { NutriWordmark } from '@/app/quiz/[step]/quiz-ui'

const PHASE_LABELS: Record<number, { name: string; description: string; emoji: string }> = {
  1: { name: 'Adaptación',    description: 'Semanas 1–4',  emoji: '🌱' },
  2: { name: 'Aceleración',   description: 'Semanas 5–8',  emoji: '⚡' },
  3: { name: 'Consolidación', description: 'Semanas 9–12', emoji: '🏆' },
}

type State = 'loading' | 'ready' | 'submitting' | 'done' | 'already_done' | 'error'

export default function CheckinPage() {
  return (
    <Suspense>
      <CheckinContent />
    </Suspense>
  )
}

function CheckinContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''

  const [state, setState] = useState<State>('loading')
  const [cycleNumber, setCycleNumber] = useState(2)
  const [name, setName] = useState('')

  // form fields
  const [weight, setWeight] = useState('')
  const [adherence, setAdherence] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!token) { setState('error'); return }
    fetch(`/api/checkins/complete?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setState('error'); return }
        if (data.alreadyCompleted) { setState('already_done'); return }
        setCycleNumber(data.cycleNumber ?? 2)
        setName(data.name ?? '')
        setState('ready')
      })
      .catch(() => setState('error'))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('submitting')
    const res = await fetch('/api/checkins/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        currentWeightKg: weight ? parseFloat(weight) : undefined,
        adherenceRating: adherence ?? undefined,
        notes: notes.trim() || undefined,
      }),
    })
    const data = await res.json()
    if (data.ok) {
      setState('done')
      setTimeout(() => router.push('/dashboard'), 3000)
    } else {
      setState('error')
    }
  }

  const phase = PHASE_LABELS[cycleNumber] ?? PHASE_LABELS[3]

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          'linear-gradient(180deg, hsl(148,38%,90%) 0px, hsl(148,28%,95%) 90px, hsl(80,18%,97%) 220px)',
      }}
    >
      <header className="sticky top-0 z-20 flex h-14 items-center justify-center border-b border-[#D4E8D0] bg-white/85 backdrop-blur-md">
        <NutriWordmark size="md" />
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-10 pt-8">
        <div className="w-full max-w-md space-y-5 quiz-enter">

          {state === 'loading' && (
            <div className="flex justify-center py-16">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
            </div>
          )}

          {state === 'error' && (
            <div className="rounded-2xl border border-red-200 bg-white p-6 text-center space-y-3">
              <p className="text-2xl">😕</p>
              <p className="font-bold text-gray-900">Enlace no válido</p>
              <p className="text-sm text-muted-foreground">
                Este enlace expiró o no existe. Si necesitas ayuda, responde al email que te enviamos.
              </p>
            </div>
          )}

          {state === 'already_done' && (
            <div className="rounded-2xl border border-[#D8E8D4] bg-white p-6 text-center space-y-3">
              <p className="text-2xl">✅</p>
              <p className="font-bold text-gray-900">Ya completaste este check-in</p>
              <p className="text-sm text-muted-foreground">Tu plan ya está siendo generado.</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="mt-2 text-sm font-semibold text-primary underline"
              >
                Ir a mi dashboard →
              </button>
            </div>
          )}

          {state === 'done' && (
            <div className="rounded-2xl border border-[#D8E8D4] bg-white p-8 text-center space-y-4">
              <p className="text-3xl">{phase.emoji}</p>
              <p className="text-xl font-black text-gray-900">¡Check-in completado!</p>
              <p className="text-sm text-muted-foreground">
                Estamos generando tu plan de la <strong>Fase {phase.name}</strong>. En unos segundos te redirigimos a tu dashboard.
              </p>
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-r-transparent" />
            </div>
          )}

          {(state === 'ready' || state === 'submitting') && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Header */}
              <div className="text-center space-y-1">
                <span className="text-3xl">{phase.emoji}</span>
                <h1 className="text-2xl font-black text-gray-900">
                  Mes {cycleNumber}: Fase {phase.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {name ? `Hola ${name.split(' ')[0]},` : 'Hola,'} responde 3 preguntas rápidas para personalizar tu nuevo plan.
                </p>
              </div>

              {/* Pregunta 1 — Peso */}
              <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-3">
                <p className="text-sm font-bold text-gray-900">
                  1. ¿Cuánto pesas hoy? <span className="font-normal text-muted-foreground">(opcional)</span>
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="30"
                    max="300"
                    step="0.1"
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    placeholder="ej. 72.5"
                    className="w-32 rounded-lg border border-[#D4E8D0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <span className="text-sm text-muted-foreground">kg</span>
                </div>
              </div>

              {/* Pregunta 2 — Aderência */}
              <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-3">
                <p className="text-sm font-bold text-gray-900">
                  2. ¿Cómo fue tu aderencia al plan este mes?
                </p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAdherence(n)}
                      className={[
                        'flex-1 rounded-xl border-2 py-3 text-sm font-bold transition-all',
                        adherence === n
                          ? 'border-primary bg-primary text-white'
                          : 'border-[#D4E8D0] bg-white text-gray-700 hover:border-primary/40',
                      ].join(' ')}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  <span>Muy poco</span>
                  <span>Perfecto</span>
                </div>
              </div>

              {/* Pregunta 3 — Notas */}
              <div className="rounded-2xl border border-[#D8E8D4] bg-white p-5 space-y-3">
                <p className="text-sm font-bold text-gray-900">
                  3. ¿Hubo algún cambio en tu rutina? <span className="font-normal text-muted-foreground">(opcional)</span>
                </p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ej: empecé a trabajar de noche, tuve una semana de vacaciones, reduje el ejercicio..."
                  rows={3}
                  className="w-full rounded-lg border border-[#D4E8D0] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* CTA */}
              <button
                type="submit"
                disabled={state === 'submitting'}
                className={[
                  'flex w-full items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-black text-white',
                  'bg-primary shadow-[0_4px_20px_0_rgba(0,0,0,0.18)]',
                  'hover:brightness-[1.04] transition-all duration-150 active:scale-[0.99]',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                ].join(' ')}
              >
                {state === 'submitting' ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                    Generando tu plan…
                  </>
                ) : (
                  <>
                    Generar mi plan de la Fase {phase.name}
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <path d="M3.5 7.5H11.5M11.5 7.5L7.5 3.5M11.5 7.5L7.5 11.5"
                        stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                Si no completas el check-in, tu plan se generará con tus datos originales.
              </p>
            </form>
          )}

        </div>
      </main>
    </div>
  )
}
