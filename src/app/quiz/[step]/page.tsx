import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { QuizStep } from './quiz-step'

const TOTAL_STEPS = 13

// Ordem VISÍVEL do quiz por número de URL (o array define o fluxo e a numeração
// "Paso X de Y"). REVERTIDO em 14/07 (dado real mostrou queda na taxa de quem
// inicia o quiz com objetivo primeiro): a URL 5 (entrada dos anúncios) volta a
// renderizar DADOS FÍSICOS como 1º passo. As chaves de dados seguem fixas por
// componente (goal→step_2, físico→step_5), então o array de URLs abaixo não
// muda com a troca.
//   URL 5=físico · 2=objetivo · 1=alimentos · 4=sexo · 6=atividade(+país) ·
//   8=restrições · 9=saúde · 10=exercício · 11=obstáculos ·
//   13=incômodo corporal · 12=ponte
const VISIBLE_ORDER = [5, 2, 1, 4, 6, 8, 9, 10, 11, 13, 12]

// Passos que não aparecem no fluxo (só alcançáveis por URL direta):
//  - 3: alimento imprescindível — OCULTO POR ENQUANTO (stub sem IA).
//  - 7: seleção de país (o país é salvo no passo de atividade, por geolocalização).
interface Props {
  params: Promise<{ step: string }>
}

export default async function QuizStepPage({ params }: Props) {
  const { step } = await params
  const stepNumber = parseInt(step, 10)

  if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > TOTAL_STEPS) {
    notFound()
  }

  // Passos ocultos: redireciona para o início do fluxo se alguém chegar via URL
  // direta (evita "Paso 0" e telas fora de ordem).
  if (stepNumber === 3 || stepNumber === 7) redirect('/quiz/5')

  // Vercel injeta esse header automaticamente em produção (geolocalização por IP).
  // Em dev local fica undefined — o usuário só vê o dropdown vazio, sem quebrar nada.
  const h = await headers()
  const detectedCountry = h.get('x-vercel-ip-country') ?? undefined

  // Numeração visível: posição do step na ordem do fluxo.
  const displayStep = VISIBLE_ORDER.indexOf(stepNumber) + 1
  const displayTotal = VISIBLE_ORDER.length // 10 passos visíveis

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
