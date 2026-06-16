'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

interface Props {
  stepNumber: number
  totalSteps: number
  displayStep: number
  displayTotal: number
  detectedCountry?: string
}

// ssr: false em todos os steps — evita hydration mismatch com sessionStorage
const Step1Favorites   = dynamic(() => import('./step1-favorites').then(m => ({ default: m.Step1Favorites })), { ssr: false })
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

function useEnsureSession() {
  const [error, setError] = useState(false)
  useEffect(() => {
    if (sessionStorage.getItem('nutriplan_session_init')) return
    fetch('/api/quiz/init-session', { method: 'POST' })
      .then(() => sessionStorage.setItem('nutriplan_session_init', '1'))
      .catch(() => setError(true))
  }, [])
  return { error }
}

export function QuizStep({ stepNumber, totalSteps, displayStep, displayTotal, detectedCountry }: Props) {
  const { error: sessionError } = useEnsureSession()

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

  if (stepNumber === 1)  return <Step1Favorites {...props} detectedCountry={detectedCountry} />
  if (stepNumber === 2)  return <Step2Goal {...props} />
  if (stepNumber === 3)  return <Step3MustHave {...props} />
  if (stepNumber === 4)  return <Step4Sex {...props} />
  if (stepNumber === 5)  return <Step5Physical {...props} />
  if (stepNumber === 6)  return <Step6Activity {...props} />
  if (stepNumber === 7)  return <Step7CountrySelect stepNumber={displayStep} totalSteps={displayTotal} detectedCountry={detectedCountry} />
  if (stepNumber === 8)  return <Step8Restrictions {...props} />
  if (stepNumber === 9)  return <Step9Health {...props} />
  if (stepNumber === 10) return <Step10Exercise {...props} />
  if (stepNumber === 11) return <Step11Obstacle {...props} />
  return <Step12Form {...props} />
}
