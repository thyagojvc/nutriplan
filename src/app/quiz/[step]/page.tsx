import { notFound } from 'next/navigation'
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

  return <QuizStep stepNumber={stepNumber} totalSteps={TOTAL_STEPS} />
}

export function generateStaticParams() {
  return Array.from({ length: TOTAL_STEPS }, (_, i) => ({ step: String(i + 1) }))
}
