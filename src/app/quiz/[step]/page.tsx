import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { QuizStep } from './quiz-step'

const TOTAL_STEPS = 12

// Passos invisíveis na numeração exibida ao usuário:
//  - 3: alimento imprescindível — OCULTO POR ENQUANTO. Sem IA, o stub só adiciona
//       uma nota de texto e não altera os alimentos de fato. Reativar junto com a IA.
//  - 7: seleção de país (auto-avança por geolocalização)
//  - 10: detalhes de treino — OCULTO POR ENQUANTO. Só alimenta o plano de treino
//        (order bump), que ainda não está à venda. Reativar junto com IA + order bump.
const HIDDEN_STEPS = [3, 7, 10]

interface Props {
  params: Promise<{ step: string }>
}

export default async function QuizStepPage({ params }: Props) {
  const { step } = await params
  const stepNumber = parseInt(step, 10)

  if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > TOTAL_STEPS) {
    notFound()
  }

  // Passos ocultos: redireciona para o anterior se alguém chegar via URL direta
  // ou pelo botão "Anterior" do passo seguinte.
  if (stepNumber === 3)  redirect('/quiz/2')
  if (stepNumber === 10) redirect('/quiz/9')

  // Vercel injeta esse header automaticamente em produção (geolocalização por IP).
  // Em dev local fica undefined — o usuário só vê o dropdown vazio, sem quebrar nada.
  const h = await headers()
  const detectedCountry = h.get('x-vercel-ip-country') ?? undefined

  // Numeração visível: descontamos cada passo oculto que vem antes do atual.
  const hiddenBefore = HIDDEN_STEPS.filter((s) => s < stepNumber).length
  const displayStep = stepNumber - hiddenBefore
  const displayTotal = TOTAL_STEPS - HIDDEN_STEPS.length // 9 passos visíveis

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
