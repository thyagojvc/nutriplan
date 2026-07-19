'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizInput, QuizCta, QuizError, ExitIntentModal } from './quiz-ui'
import { trackDualOnce } from '@/lib/fb-pixel'

const EXIT_FLAG = 'nutriplan_exit_intent_shown'

interface PhysicalData {
  age: string
  weight_kg: string
  height_cm: string
}

interface Props {
  stepNumber: number
  totalSteps: number
}

// 19/07: Step5Physical é a PORTA DE ENTRADA do quiz (URL /quiz/5, pra onde os
// anúncios apontam). Por isso concentra as features de 1ª tela: banner da
// promessa dos 60s, exit-intent no botão voltar (maior ponto de abandono é quem
// clica no anúncio e nem responde nada) e o evento QuizFirstAnswer ao concluir a
// 1ª pergunta. Antes essas features viviam no obstáculo, que era a entrada.
export function Step5Physical({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  const [data, setData] = useState<PhysicalData>(() => {
    if (typeof window === 'undefined') return { age: '', weight_kg: '', height_cm: '' }
    try {
      const cached = sessionStorage.getItem('nutriplan_step_5')
      const parsed = cached ? (JSON.parse(cached) as Partial<PhysicalData>) : {}
      return {
        age: String(parsed.age ?? ''),
        weight_kg: String(parsed.weight_kg ?? ''),
        height_cm: String(parsed.height_cm ?? ''),
      }
    } catch { return { age: '', weight_kg: '', height_cm: '' } }
  })

  const [ageBlocked, setAgeBlocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)

  const isEmpty = !data.age && !data.weight_kg && !data.height_cm

  // Ref pra o listener de popstate ler o estado mais recente sem cair em
  // closure obsoleta (o listener é registrado uma única vez, no mount).
  const stateRef = useRef({ isEmpty, saving })
  useEffect(() => { stateRef.current = { isEmpty, saving } }, [isEmpty, saving])

  // Intercepta o botão "voltar" só nesta primeira pregunta (URL de entrada dos
  // anúncios), que é onde mais gente abandona sem sequer responder nada. Empilha
  // uma entrada extra no histórico: o primeiro "voltar" fica retido aqui (mostra
  // o modal), o segundo já deixa sair normal, pra não virar uma prisão de botão.
  // guardPushedRef evita empilhar 2x: em dev o Strict Mode roda este efeito duas
  // vezes (mount → cleanup → mount) só pra flagar efeitos colaterais não-idempotentes.
  const guardPushedRef = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(EXIT_FLAG) === '1') return
    if (!stateRef.current.isEmpty) return

    if (!guardPushedRef.current) {
      guardPushedRef.current = true
      window.history.pushState(null, '', window.location.href)
    }

    function handlePopState() {
      if (!stateRef.current.isEmpty || stateRef.current.saving) return
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

  function handleChange(field: keyof PhysicalData, val: string) {
    const next = { ...data, [field]: val }
    setData(next)
    setAgeBlocked(false)
    sessionStorage.setItem('nutriplan_step_5', JSON.stringify(next))
  }

  const age = parseInt(data.age, 10)
  const weight = parseFloat(data.weight_kg)
  const height = parseFloat(data.height_cm)

  const isValid =
    !isNaN(age) && age >= 1 && age <= 100 &&
    !isNaN(weight) && weight >= 40 && weight <= 250 &&
    !isNaN(height) && height >= 130 && height <= 220

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || saving) return

    if (age < 18) {
      setAgeBlocked(true)
      return
    }

    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 5, answers: { age, weight_kg: weight, height_cm: height } }),
      })
      if (!res.ok) { setError(true); return }
      // Marca "iniciou o quiz de fato" (respondeu a 1ª pergunta). Junto com o
      // QuizStart (dispara no landing), permite montar no Meta o público de
      // exclusão "clicou no link mas não iniciou" = QuizStart EXCLUDE QuizFirstAnswer.
      trackDualOnce('px_quiz_first_answer', 'QuizFirstAnswer', undefined, { custom: true })
      router.push('/quiz/1') // → alimentos favoritos
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const progress = Math.round((stepNumber / totalSteps) * 100)

  if (ageBlocked) {
    return (
      <QuizLayout>
        <QuizCard>
          <div className="py-4 text-center space-y-4">
            <p className="text-5xl">🚫</p>
            <h1 className="text-xl font-bold text-gray-900">Lo sentimos</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              NutriPlan es exclusivo para personas mayores de 18 años.
              No podemos continuar con tu solicitud.
            </p>
          </div>
        </QuizCard>
      </QuizLayout>
    )
  }

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

      <form onSubmit={handleContinue} className="space-y-4">
        <QuizCard>
          <QuizHeader
            title="Empecemos con tus datos físicos"
            subtitle="Los usaremos para calcular tus calorías y macros exactos. Nadie más los verá."
          />

          <div className="space-y-4">
            <QuizInput
              label="Edad (años)"
              type="number"
              min={1}
              max={100}
              placeholder="Ej: 28"
              value={data.age}
              onChange={(e) => handleChange('age', e.target.value)}
              autoFocus
              hint={data.age !== '' && !isNaN(parseInt(data.age)) && parseInt(data.age) < 18
                ? 'Debes tener al menos 18 años.'
                : undefined}
            />

            <div className="grid grid-cols-2 gap-3">
              <QuizInput
                label="Peso (kg)"
                type="number"
                min={40}
                max={250}
                step={0.1}
                placeholder="Ej: 70"
                value={data.weight_kg}
                onChange={(e) => handleChange('weight_kg', e.target.value)}
              />
              <QuizInput
                label="Altura (cm)"
                type="number"
                min={130}
                max={220}
                placeholder="Ej: 170"
                value={data.height_cm}
                onChange={(e) => handleChange('height_cm', e.target.value)}
              />
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Cuanto más exactos sean tus datos, más preciso será tu plan 🎯
          </p>

          {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
        </QuizCard>

        <QuizCta type="submit" disabled={!isValid} loading={saving} />
      </form>

      {showExitModal && (
        <ExitIntentModal onStay={() => setShowExitModal(false)} onLeave={handleLeaveAnyway} />
      )}
    </QuizLayout>
  )
}
