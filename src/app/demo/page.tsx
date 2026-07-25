import type { Metadata } from 'next'
import { parseAnswers } from '@/lib/nutrition/answers'
import { calcTargets } from '@/lib/nutrition/math'
import { generateNutritionPlan, generateTrainingPlan } from '@/lib/nutrition/generate'
import { DashboardShell } from '@/app/(dashboard)/dashboard/dashboard-shell'

// =============================================================================
// Painel de demonstração — dados de exemplo, sem login, disponível em produção.
// Existe para poder "Añadir a pantalla de inicio" e reabrir depois como um app
// de verdade, pra gravação de vídeo/marketing (usa o manifest próprio abaixo,
// com start_url apontando pra cá — não pra /dashboard, que exige sessão real).
// Acesse: /demo?training=1&recipes=1 (assim já abre com tudo desbloqueado)
// =============================================================================

export const metadata: Metadata = {
  manifest: '/manifest-demo.webmanifest',
  icons: { apple: '/logo-perfil.png' },
  robots: { index: false, follow: false },
}

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

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ training?: string; recipes?: string }>
}) {
  const { training, recipes } = await searchParams
  const hasTraining = training === '1'
  const hasRecipes = recipes === '1'

  const answers = parseAnswers(SAMPLE_DRAFT, 'MX')
  const targets = calcTargets(answers)
  const plan = await generateNutritionPlan(answers, targets, 1, undefined, 4)
  const trainingPlan = hasTraining ? await generateTrainingPlan(answers) : null

  const profile = {
    age: answers.age,
    weightKg: answers.weightKg,
    heightCm: answers.heightCm,
    sex: answers.sex,
    activityLevel: 'ligeramente_activo',
  }

  const docKinds = ['nutrition_plan', 'anti_celulitis', ...(hasTraining ? ['training_plan'] : []), ...(hasRecipes ? ['recipes'] : [])]

  return (
    <DashboardShell
      plan={plan}
      name="Valentina García"
      docKinds={docKinds}
      docUrls={Object.fromEntries(docKinds.map((k) => [k, `/api/demo/documents/${k}`]))}
      profile={profile}
      trainingPlan={trainingPlan}
      orderId="demo-order"
      trainingCheckoutUrl={process.env.NEXT_PUBLIC_HOTMART_TRAINING_CHECKOUT_URL}
    />
  )
}
