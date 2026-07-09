'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { trackPixelOnce } from '@/lib/fb-pixel'

interface Props {
  stepNumber: number
  totalSteps: number
  displayStep: number
  displayTotal: number
  detectedCountry?: string
}

// ssr: false em todos os steps — evita hydration mismatch com sessionStorage
const Step1Likes       = dynamic(() => import('./step1-likes').then(m => ({ default: m.Step1Likes })), { ssr: false })
const Step2Goal        = dynamic(() => import('./step2-goal').then(m => ({ default: m.Step2Goal })), { ssr: false })
const Step3MustHave    = dynamic(() => import('./step3-must-have').then(m => ({ default: m.Step3MustHave })), { ssr: false })
const Step4Sex         = dynamic(() => import('./step4-sex').then(m => ({ default: m.Step4Sex })), { ssr: false })
const Step5Physical    = dynamic(() => import('./step5-physical').then(m => ({ default: m.Step5Physical })), { ssr: false })
const Step6Activity    = dynamic(() => import('./step6-activity').then(m => ({ default: m.Step6Activity })), { ssr: false })
const Step7CountrySelect = dynamic(() => import('./step7-country-select').then(m => ({ default: m.Step7CountrySelect })), { ssr: false })
const Step8Restrictions = dynamic(() => import('./step8-restrictions').then(m => ({ default: m.Step8Restrictions })), { ssr: false })
const Step9Health      = dynamic(() => import('./step9-health').then(m => ({ default: m.Step9Health })), { ssr: false })
const Step10Exercise   = dynamic(() => import('./step10-exercise').then(m => ({ default: m.Step10Exercise })), { ssr: false })
const Step11Obstacle   = dynamic(() => import('./step11-obstacle').then(m => ({ default: m.Step11Obstacle })), { ssr: false })
const Step12Form       = dynamic(() => import('./step12-form').then(m => ({ default: m.Step12Form })), { ssr: false })
const Step13BodyConcern = dynamic(() => import('./step13-body-concern').then(m => ({ default: m.Step13BodyConcern })), { ssr: false })

function useEnsureSession() {
  const [error, setError] = useState(false)
  useEffect(() => {
    if (sessionStorage.getItem('nutriplan_session_init')) return
    // Captura o criativo/anúncio de origem (utm_content) da URL, se veio de
    // anúncio pago. Configurar no Meta Ads: URL parameters -> utm_content={{ad.name}}
    const adRef = new URLSearchParams(window.location.search).get('utm_content') ?? undefined
    fetch('/api/quiz/init-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad_ref: adRef }),
    })
      .then(() => sessionStorage.setItem('nutriplan_session_init', '1'))
      .catch(() => setError(true))
  }, [])
  return { error }
}

export function QuizStep({ stepNumber, totalSteps, displayStep, displayTotal, detectedCountry }: Props) {
  const { error: sessionError } = useEnsureSession()

  // Início do quiz: dispara uma vez por sessão no passo de entrada (dados físicos).
  useEffect(() => {
    if (stepNumber === 5) trackPixelOnce('px_quiz_start', 'QuizStart', undefined, { custom: true })
  }, [stepNumber])

  if (sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-destructive">
          Error al iniciar la sesión. Recarga la página.
        </p>
      </div>
    )
  }

  const props = { stepNumber: displayStep, totalSteps: displayTotal }

  // NOTA: a URL /quiz/5 é a porta de entrada dos anúncios e por isso renderiza o
  // 1º passo do fluxo. Para reduzir abandono no início, a ordem visível começa
  // por perguntas fáceis: 1º OBJETIVO, 2º SEXO, 3º alimentos, 4º dados físicos.
  // Por isso o conteúdo das URLs está trocado em relação ao número: URL 5→objetivo,
  // URL 2→sexo, URL 4→dados físicos. As chaves de dados continuam fixas por
  // componente (goal→step_2, sexo→step_4, físico→step_5), sem afetar geração.
  if (stepNumber === 1)  return <Step1Likes {...props} detectedCountry={detectedCountry} />
  if (stepNumber === 2)  return <Step4Sex {...props} />
  if (stepNumber === 3)  return <Step3MustHave {...props} />
  if (stepNumber === 4)  return <Step5Physical {...props} />
  if (stepNumber === 5)  return <Step2Goal {...props} />
  if (stepNumber === 6)  return <Step6Activity {...props} detectedCountry={detectedCountry} />
  if (stepNumber === 7)  return <Step7CountrySelect stepNumber={displayStep} totalSteps={displayTotal} detectedCountry={detectedCountry} />
  if (stepNumber === 8)  return <Step8Restrictions {...props} />
  if (stepNumber === 9)  return <Step9Health {...props} />
  if (stepNumber === 10) return <Step10Exercise {...props} />
  if (stepNumber === 11) return <Step11Obstacle {...props} />
  if (stepNumber === 13) return <Step13BodyConcern {...props} />
  return <Step12Form {...props} />
}
