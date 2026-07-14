'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizOption, QuizCta, QuizError, ExitIntentModal } from './quiz-ui'
import { trackDualOnce } from '@/lib/fb-pixel'

const EXIT_FLAG = 'nutriplan_exit_intent_shown'

const GOALS = [
  { id: 'perder_peso',   label: 'Perder peso',          desc: 'Quiero reducir mi grasa corporal',                     emoji: '🔥' },
  { id: 'mantener',      label: 'Mantener mi peso',      desc: 'Quiero mantenerme saludable sin cambiar mi peso',      emoji: '⚖️' },
  { id: 'ganar_masa',    label: 'Ganar masa muscular',   desc: 'Quiero aumentar mi masa muscular',                     emoji: '💪' },
]

interface Props {
  stepNumber: number
  totalSteps: number
}

export function Step2Goal({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [selected, setSelected] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem('nutriplan_step_2')
      const parsed = cached ? (JSON.parse(cached) as { goal?: string }) : {}
      return parsed.goal ?? null
    } catch { return null }
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)

  // Ref pra o listener de popstate ler o estado mais recente sem cair em
  // closure obsoleta (o listener é registrado uma única vez, no mount).
  const stateRef = useRef({ selected, saving })
  useEffect(() => { stateRef.current = { selected, saving } }, [selected, saving])

  // Intercepta o botão "voltar" só nesta primeira pregunta, que é onde mais
  // gente abandona sem sequer responder nada. Empilha uma entrada extra no
  // histórico: o primeiro "voltar" fica retido aqui (mostra o modal), o
  // segundo já deixa sair normal, pra não virar uma prisão de botão.
  // guardPushedRef evita empilhar 2x: em dev o Strict Mode roda este efeito
  // duas vezes (mount → cleanup → mount) só pra flagar efeitos colaterais
  // não-idempotentes como este pushState.
  const guardPushedRef = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(EXIT_FLAG) === '1') return
    if (stateRef.current.selected) return

    if (!guardPushedRef.current) {
      guardPushedRef.current = true
      window.history.pushState(null, '', window.location.href)
    }

    function handlePopState() {
      if (stateRef.current.selected || stateRef.current.saving) return
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

  function handleSelect(id: string) {
    setSelected(id)
    // sessionStorage pode falhar (ex: navegador interno do Instagram/Facebook
    // com armazenamento restrito) — não pode bloquear o avanço se isso acontecer.
    try {
      sessionStorage.setItem('nutriplan_step_2', JSON.stringify({ goal: id }))
    } catch { /* segue sem cache local; o save-step ainda persiste no banco */ }
    // Escolha única: avança direto, sem exigir o clique em Continuar
    submit(id)
  }

  async function submit(goal: string) {
    if (!goal || saving) return
    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 2, answers: { goal } }),
      })
      if (!res.ok) { setError(true); setSaving(false); return }
      // Marca "iniciou o quiz de fato" (respondeu a 1ª pergunta). Junto com o
      // QuizStart (dispara no landing), permite montar no Meta o público de
      // exclusão "clicou no link mas não iniciou" = QuizStart EXCLUDE QuizFirstAnswer.
      trackDualOnce('px_quiz_first_answer', 'QuizFirstAnswer', undefined, { custom: true })
      router.push('/quiz/1') // → alimentos favoritos
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
          title="¿Cuál es tu objetivo principal?"
          subtitle="Tu plan será completamente diferente según lo que elijas."
        />

        <div className="space-y-2.5">
          {GOALS.map(({ id, label, desc, emoji }) => (
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

      {showExitModal && (
        <ExitIntentModal onStay={() => setShowExitModal(false)} onLeave={handleLeaveAnyway} />
      )}
    </QuizLayout>
  )
}
