import { NextRequest, NextResponse } from 'next/server'
import { parseAnswers } from '@/lib/nutrition/answers'
import { calcTargets } from '@/lib/nutrition/math'
import { generateNutritionPlan, generateTrainingPlan } from '@/lib/nutrition/generate'
import { renderNutritionPdf, renderTrainingPdf } from '@/lib/nutrition/pdf'
import { renderAntiCelulitisPdf } from '@/lib/nutrition/anti-celulitis-pdf'
import { renderRecipesPdf } from '@/lib/nutrition/recipes-pdf'

// PDFs de exemplo pro painel de demonstração (/demo) — sem dado real, sem
// autenticação, disponível em produção. Mesmos geradores usados na entrega
// de verdade, só que sempre com o mesmo perfil de amostra.

const SAMPLE_DRAFT = {
  step_1: { likes: ['pollo', 'huevo', 'arroz', 'avena', 'frutas', 'verduras'] },
  step_2: { goal: 'perder_peso' },
  step_3: { must_have: 'café por la mañana' },
  step_4: { sex: 'femenino' },
  step_5: { age: 34, weight_kg: 72, height_cm: 165 },
  step_6: { activity_level: 'ligeramente_activo', activity_factor: 1.375 },
  step_8: { restrictions: [] },
  step_9: { health: ['ninguna_condicion'] },
  step_10: { limitations: ['ninguna'], experience: 'principiante', location: 'casa', frequency: '3_4' },
}

const FILE_NAME: Record<string, string> = {
  nutrition_plan: 'plan-nutricional.pdf',
  training_plan: 'plan-entrenamiento.pdf',
  anti_celulitis: 'guia-anti-celulitis.pdf',
  recipes: '28-recetas-fitness.pdf',
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  if (!FILE_NAME[kind]) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const answers = parseAnswers(SAMPLE_DRAFT, 'MX')

  let pdf: Buffer
  if (kind === 'anti_celulitis') {
    pdf = await renderAntiCelulitisPdf()
  } else if (kind === 'recipes') {
    pdf = await renderRecipesPdf()
  } else if (kind === 'training_plan') {
    const trainingPlan = await generateTrainingPlan(answers)
    pdf = await renderTrainingPdf(trainingPlan, 'Valentina García')
  } else {
    const targets = calcTargets(answers)
    const plan = await generateNutritionPlan(answers, targets, 1, undefined, 4)
    pdf = await renderNutritionPdf(plan, 'Valentina García')
  }

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${FILE_NAME[kind]}"`,
    },
  })
}
