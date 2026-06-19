import { NextResponse } from 'next/server'
import { parseAnswers } from '@/lib/nutrition/answers'
import { calcTargets } from '@/lib/nutrition/math'
import { generateNutritionPlan } from '@/lib/nutrition/generate'
import { renderNutritionPdf } from '@/lib/nutrition/pdf'

// DEV-ONLY: gera o PDF nutricional de exemplo para inspecionar o layout.
// http://localhost:3000/dev/plan-pdf  (404 em produção)

const SAMPLE_DRAFT = {
  step_1: { dislikes: ['cerdo', 'mariscos'] },
  step_2: { goal: 'perder_peso' },
  step_3: { must_have: 'café por la mañana' },
  step_4: { sex: 'femenino' },
  step_5: { age: 34, weight_kg: 72, height_cm: 165 },
  step_6: { activity_level: 'ligeramente_activo', activity_factor: 1.375 },
  step_8: { restrictions: [] },
  step_9: { health: ['ninguna_condicion'] },
  step_10: { limitations: ['ninguna'], experience: 'principiante', location: 'casa', frequency: '3_4' },
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const answers = parseAnswers(SAMPLE_DRAFT, 'MX')
  const targets = calcTargets(answers)
  const plan = await generateNutritionPlan(answers, targets, 1)
  const pdf = await renderNutritionPdf(plan, 'María González')

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="plan-preview.pdf"',
    },
  })
}
