'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizOption, QuizCta, QuizError } from './quiz-ui'

const OPTIONS = [
  { id: 'ropa',      label: 'La ropa que ya no me queda',        desc: 'Guardé cosas esperando volver a usarlas',        emoji: '👗' },
  { id: 'playa',     label: 'No sentirme cómoda en la playa o piscina', desc: 'Evito esas situaciones si puedo',        emoji: '🏖️' },
  { id: 'fotos',     label: 'Evitar salir en fotos',              desc: 'Me escondo o pido que no me tomen fotos',        emoji: '📸' },
  { id: 'espejo',    label: 'No reconocerme frente al espejo',    desc: 'Siento que no soy la misma de antes',            emoji: '🪞' },
  { id: 'eventos',   label: 'No sentirme segura en eventos o citas', desc: 'Me preocupa cómo me veo antes de salir',      emoji: '💃' },
  { id: 'cansancio', label: 'Cansarme o quedarme sin aire fácil', desc: 'Cosas simples ya me cuestan más de lo normal',   emoji: '😮‍💨' },
  { id: 'otro',      label: 'Otra cosa',                          desc: 'Cuéntanos con tus palabras',                     emoji: '✍️' },
]

// Este dato alimenta el botón emocional de la preview (ver /src/app/preview/page.tsx).
// Cuando la respuesta es "otro", no hay frase pre-hecha para basarse — la preview
// usa un botón emocional genérico en ese caso (ver BODY_CONCERN_CTA fallback).

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step13BodyConcern({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem('nutriplan_step_13')
      const parsed = cached ? (JSON.parse(cached) as { concern?: string }) : {}
      return parsed.concern ?? null
    } catch { return null }
  })

  const [otherText, setOtherText] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try {
      const cached = sessionStorage.getItem('nutriplan_step_13')
      const parsed = cached ? (JSON.parse(cached) as { concern_detail?: string }) : {}
      return parsed.concern_detail ?? ''
    } catch { return '' }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  // Confirma quantos obstáculos foram marcados no passo anterior.
  const [obstacleCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    try {
      const cached = sessionStorage.getItem('nutriplan_step_11')
      const parsed = cached ? (JSON.parse(cached) as { obstacles?: string[] }) : {}
      return parsed.obstacles?.length ?? 0
    } catch { return 0 }
  })

  async function submit(concern: string, detail: string) {
    if (saving) return
    if (concern === 'otro' && detail.trim().length === 0) return

    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 13,
          answers: { concern, concern_detail: concern === 'otro' ? detail.trim() : null },
        }),
      })
      if (!res.ok) { setError(true); setSaving(false); return }
      router.push('/quiz/12')
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  function handleSelect(id: string) {
    setSelected(id)
    // sessionStorage pode falhar (ex: navegador interno do Instagram/Facebook
    // com armazenamento restrito) — não pode bloquear o avanço se isso acontecer.
    try {
      sessionStorage.setItem('nutriplan_step_13', JSON.stringify({ concern: id, concern_detail: id === 'otro' ? otherText : null }))
    } catch { /* segue sem cache local; o save-step ainda persiste no banco */ }
    // Auto-avança nas opções predefinidas — só "otro" precisa do texto antes.
    if (id !== 'otro') submit(id, '')
  }

  function handleOtherChange(value: string) {
    setOtherText(value)
    try {
      sessionStorage.setItem('nutriplan_step_13', JSON.stringify({ concern: 'otro', concern_detail: value }))
    } catch { /* segue sem cache local */ }
  }

  const progress = Math.round((stepNumber / totalSteps) * 100)
  const showOtherField = selected === 'otro'

  return (
    <QuizLayout>
      <QuizProgress step={stepNumber} total={totalSteps} pct={progress} />

      <QuizCard>
        <QuizHeader
          confirm={obstacleCount > 0 ? `${obstacleCount} obstáculo${obstacleCount !== 1 ? 's' : ''} identificado${obstacleCount !== 1 ? 's' : ''}. Última pregunta antes de calcular tu plan.` : undefined}
          title="¿Qué es lo que más te incomoda hoy de tu cuerpo?"
          subtitle="Elige lo que más pese para ti — esto también forma parte de tu plan."
        />

        <div className="space-y-2.5">
          {OPTIONS.map(({ id, label, desc, emoji }) => (
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

        {showOtherField && (
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">Cuéntanos con tus palabras</label>
            <textarea
              value={otherText}
              onChange={(e) => handleOtherChange(e.target.value)}
              placeholder="Escribe aquí lo que sientes..."
              rows={3}
              className={[
                'w-full rounded-xl border border-[#D8E8D4] bg-white px-4 py-3 text-sm text-gray-900',
                'placeholder:text-gray-400 resize-none',
                'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
                'transition-shadow duration-150',
              ].join(' ')}
            />
          </div>
        )}

        {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
      </QuizCard>

      {showOtherField && (
        <QuizCta
          onClick={() => submit('otro', otherText)}
          disabled={otherText.trim().length === 0}
          loading={saving}
        >
          Continuar
        </QuizCta>
      )}
    </QuizLayout>
  )
}
