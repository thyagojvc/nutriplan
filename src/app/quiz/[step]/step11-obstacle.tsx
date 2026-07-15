'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizOption, QuizCta, QuizError, ExitIntentModal } from './quiz-ui'
import { trackDualOnce } from '@/lib/fb-pixel'

const EXIT_FLAG = 'nutriplan_exit_intent_shown'

const OPTIONS = [
  { id: 'falta_tiempo',      label: 'Falta de tiempo',         desc: 'Mi agenda está siempre llena',                emoji: '⏰' },
  { id: 'falta_motivacion',  label: 'Falta de motivación',     desc: 'Me cuesta mantener la constancia',            emoji: '😔' },
  { id: 'no_se_que_comer',   label: 'No sé qué comer',         desc: 'Me pierdo entre tanta información',           emoji: '🤔' },
  { id: 'comer_fuera',       label: 'Comer fuera de casa',     desc: 'Trabajo o viajo mucho',                       emoji: '🍽️' },
  { id: 'presupuesto',       label: 'Presupuesto limitado',    desc: 'Quiero comer bien sin gastar mucho',          emoji: '💰' },
  { id: 'antojos',           label: 'Antojos y tentaciones',   desc: 'Me cuesta resistir ciertos alimentos',        emoji: '🍰' },
]

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step11Obstacle({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const cached = sessionStorage.getItem('nutriplan_step_11')
      const parsed = cached ? (JSON.parse(cached) as { obstacles?: string[] }) : {}
      return parsed.obstacles ?? []
    } catch { return [] }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)

  // Ref pra o listener de popstate ler o estado mais recente sem cair em
  // closure obsoleta (o listener é registrado uma única vez, no mount).
  const stateRef = useRef({ selected, saving })
  useEffect(() => { stateRef.current = { selected, saving } }, [selected, saving])

  // Intercepta o botão "voltar" só nesta primeira pregunta (URL de entrada dos
  // anúncios, ver nota em quiz-step.tsx), que é onde mais gente abandona sem
  // sequer responder nada. Empilha uma entrada extra no histórico: o primeiro
  // "voltar" fica retido aqui (mostra o modal), o segundo já deixa sair normal,
  // pra não virar uma prisão de botão. guardPushedRef evita empilhar 2x: em dev
  // o Strict Mode roda este efeito duas vezes (mount → cleanup → mount) só pra
  // flagar efeitos colaterais não-idempotentes como este pushState.
  const guardPushedRef = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(EXIT_FLAG) === '1') return
    if (stateRef.current.selected.length > 0) return

    if (!guardPushedRef.current) {
      guardPushedRef.current = true
      window.history.pushState(null, '', window.location.href)
    }

    function handlePopState() {
      if (stateRef.current.selected.length > 0 || stateRef.current.saving) return
      if (sessionStorage.getItem(EXIT_FLAG) === '1') return
      sessionStorage.setItem(EXIT_FLAG, '1')
      setShowExitModal(true)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function handleLeaveAnyway() {
    setShowExitModal(false)
    router.back()
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      try {
        sessionStorage.setItem('nutriplan_step_11', JSON.stringify({ obstacles: next }))
      } catch { /* segue sem cache local; o save-step no Continuar ainda persiste */ }
      return next
    })
  }

  async function handleContinue() {
    if (selected.length === 0 || saving) return
    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 11, answers: { obstacles: selected } }),
      })
      if (!res.ok) { setError(true); return }
      // Marca "iniciou o quiz de fato" (respondeu a 1ª pergunta, agora esta).
      // Junto com o QuizStart (dispara no landing), permite montar no Meta o
      // público de exclusão "clicou no link mas não iniciou" = QuizStart
      // EXCLUDE QuizFirstAnswer.
      trackDualOnce('px_quiz_first_answer', 'QuizFirstAnswer', undefined, { custom: true })
      router.push('/quiz/2') // → objetivo
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const progress = Math.round((stepNumber / totalSteps) * 100)

  return (
    <QuizLayout>
      <QuizProgress step={stepNumber} total={totalSteps} pct={progress} />

      {/* Promessa de entrada — só aparece neste passo, que é o início do quiz */}
      <div className="flex items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/8 px-4 py-2.5 text-center">
        <span className="text-base">⏱️</span>
        <p className="text-[13px] font-bold leading-snug text-primary">
          Responde este quiz de 60 segundos y recibe tu plan y tu entrenamiento personalizados
        </p>
      </div>

      <QuizCard>
        <QuizHeader
          title="¿Cuáles son tus mayores obstáculos para mejorar tu alimentación?"
          subtitle="Selecciona todos los que apliquen — tu plan los tomará en cuenta."
        />

        <div className="space-y-2.5">
          {OPTIONS.map(({ id, label, desc, emoji }) => (
            <QuizOption
              key={id}
              label={label}
              desc={desc}
              emoji={emoji}
              selected={selected.includes(id)}
              onSelect={() => toggle(id)}
            />
          ))}
        </div>

        {selected.length > 0 && (
          <p className="text-center text-xs text-primary font-medium">
            {selected.length} seleccionado{selected.length !== 1 ? 's' : ''} ✓
          </p>
        )}

        {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
      </QuizCard>

      <QuizCta onClick={handleContinue} disabled={selected.length === 0} loading={saving}>
        Continuar
      </QuizCta>

      {showExitModal && (
        <ExitIntentModal onStay={() => setShowExitModal(false)} onLeave={handleLeaveAnyway} />
      )}
    </QuizLayout>
  )
}
