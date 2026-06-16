import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { QuizStep } from './quiz-step'

const TOTAL_STEPS = 12

interface Props {
  params: Promise<{ step: string }>
}

export default async function QuizStepPage({ params }: Props) {
  const { step } = await params
  const stepNumber = parseInt(step, 10)

  if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > TOTAL_STEPS) {
    notFound()
  }

  // Vercel injeta esse header automaticamente em produção (geolocalização por IP).
  // Em dev local fica undefined — o usuário só vê o dropdown vazio, sem quebrar nada.
  const h = await headers()
  const detectedCountry = h.get('x-vercel-ip-country') ?? undefined

  // Step 7 é invisível (auto-avança); descontamos ele da numeração visível.
  const displayStep = stepNumber > 7 ? stepNumber - 1 : stepNumber
  const displayTotal = TOTAL_STEPS - 1 // 11 passos visíveis

  return (
    <QuizStep
      stepNumber={stepNumber}
      totalSteps={TOTAL_STEPS}
      displayStep={displayStep}
      displayTotal={displayTotal}
      detectedCountry={detectedCountry}
    />
  )
}

export function generateStaticParams() {
  return Array.from({ length: TOTAL_STEPS }, (_, i) => ({ step: String(i + 1) }))
}
