'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { QuizLayout, QuizProgress, QuizCard, QuizHeader, QuizStepperRow, QuizCta, QuizError, ExitIntentModal } from './quiz-ui'
import { trackDualOnce } from '@/lib/fb-pixel'

const EXIT_FLAG = 'nutriplan_exit_intent_shown'

interface PhysicalData {
  age: number
  weight_kg: number
  height_cm: number
}

// Valores iniciais plausíveis pro avatar (mulher 25-45 LATAM). A tela abre com
// números visíveis pra corrigir, não campos vazios pra preencher: o 1º toque
// vira um tap no −/+ (ou no número, pra digitar) em vez de digitação obrigatória
// com teclado pulando na tela — era o maior atrito da 1ª pregunta.
const DEFAULTS: PhysicalData = { age: 30, weight_kg: 70, height_cm: 160 }

interface Props {
  stepNumber: number
  totalSteps: number
}

// 19/07: Step5Physical é a PORTA DE ENTRADA do quiz (URL /quiz/5, pra onde os
// anúncios apontam). Por isso concentra as features de 1ª tela: banner da
// promessa dos 60s, exit-intent no botão voltar (maior ponto de abandono é quem
// clica no anúncio e nem responde nada) e o evento QuizFirstAnswer ao concluir a
// 1ª pergunta. Antes essas features viviam no obstáculo, que era a entrada.
// 21/07: inputs digitados viraram steppers pré-preenchidos (QuizStepperRow).
export function Step5Physical({ stepNumber, totalSteps }: Props) {
  const router = useRouter()

  // touched = a pessoa já interagiu com algum valor (ou voltou com cache).
  // Substitui o antigo isEmpty do exit-intent: com defaults, campo vazio não
  // existe mais.
  const [touched, setTouched] = useState(false)

  const [data, setData] = useState<PhysicalData>(() => {
    if (typeof window === 'undefined') return DEFAULTS
    try {
      const cached = sessionStorage.getItem('nutriplan_step_5')
      if (!cached) return DEFAULTS
      const parsed = JSON.parse(cached) as Partial<PhysicalData>
      return {
        age: Number(parsed.age) || DEFAULTS.age,
        weight_kg: Number(parsed.weight_kg) || DEFAULTS.weight_kg,
        height_cm: Number(parsed.height_cm) || DEFAULTS.height_cm,
      }
    } catch { return DEFAULTS }
  })

  // Quem voltou com cache já interagiu antes — não mostrar exit-intent de novo.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('nutriplan_step_5')) setTouched(true)
    } catch {}
  }, [])

  const [ageBlocked, setAgeBlocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)

  // Ref pra o listener de popstate ler o estado mais recente sem cair em
  // closure obsoleta (o listener é registrado uma única vez, no mount).
  const stateRef = useRef({ touched, saving })
  useEffect(() => { stateRef.current = { touched, saving } }, [touched, saving])

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
    if (stateRef.current.touched) return

    if (!guardPushedRef.current) {
      guardPushedRef.current = true
      window.history.pushState(null, '', window.location.href)
    }

    function handlePopState() {
      if (stateRef.current.touched || stateRef.current.saving) return
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

  function handleChange(field: keyof PhysicalData, val: number) {
    const next = { ...data, [field]: val }
    setData(next)
    setTouched(true)
    setAgeBlocked(false)
    try {
      sessionStorage.setItem('nutriplan_step_5', JSON.stringify(next))
    } catch { /* in-app browsers com storage restrito: segue sem cache local */ }
  }

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return

    if (data.age < 18) {
      setAgeBlocked(true)
      return
    }

    setSaving(true)
    setError(false)
    try {
      const res = await fetch('/api/quiz/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 5, answers: { age: data.age, weight_kg: data.weight_kg, height_cm: data.height_cm } }),
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

      {/* Linha de motivação pra iniciar — reforça a promessa em número concreto
          antes de pedir o primeiro dado (ver histórico de abandono na entrada
          em quiz-step.tsx). */}
      <p className="text-center text-[13px] leading-relaxed text-gray-700 px-1">
        En menos de 60 segundos vas a tener un número exacto: cuántas calorías tu cuerpo necesita hoy para bajar de peso, sin dietas genéricas de internet.
      </p>

      <form onSubmit={handleContinue} className="space-y-4">
        <QuizCard>
          <QuizHeader
            title="Empecemos con tus datos físicos"
            subtitle="Ajusta cada número al tuyo. Los usaremos para calcular tus calorías y macros exactos. Nadie más los verá."
          />

          <div className="space-y-2.5">
            <QuizStepperRow
              label="Edad"
              emoji="🎂"
              unit="años"
              min={16}
              max={90}
              value={data.age}
              onChange={(v) => handleChange('age', v)}
            />
            <QuizStepperRow
              label="Peso"
              emoji="⚖️"
              unit="kg"
              min={40}
              max={250}
              value={data.weight_kg}
              onChange={(v) => handleChange('weight_kg', v)}
            />
            <QuizStepperRow
              label="Altura"
              emoji="📏"
              unit="cm"
              min={130}
              max={220}
              value={data.height_cm}
              onChange={(v) => handleChange('height_cm', v)}
            />
          </div>

          {data.age < 18 && (
            <p className="text-center text-xs text-red-500">Debes tener al menos 18 años.</p>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Toca el número para escribirlo, o ajusta con − y +. Cuanto más exactos, más preciso será tu plan 🎯
          </p>

          {error && <QuizError message="Error al guardar. Intenta de nuevo." />}
        </QuizCard>

        <QuizCta type="submit" loading={saving} />
      </form>

      {showExitModal && (
        <ExitIntentModal onStay={() => setShowExitModal(false)} onLeave={handleLeaveAnyway} />
      )}
    </QuizLayout>
  )
}
