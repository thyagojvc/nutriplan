import { notFound } from 'next/navigation'
import { parseAnswers } from '@/lib/nutrition/answers'
import { calcTargets } from '@/lib/nutrition/math'
import { generateNutritionPlan } from '@/lib/nutrition/generate'
import { PlanView } from '@/app/(dashboard)/dashboard/plan-view'

// =============================================================================
// DEV-ONLY: visualiza o plano que o cliente recebe (gerador stub, sem IA).
// Acesse http://localhost:3000/dev/plan-preview
// Edite SAMPLE_DRAFT para testar perfis diferentes (objetivo, sexo, restrições).
// Não existe em produção (retorna 404).
// =============================================================================

// Respostas de exemplo no mesmo formato de generation_sessions.draft_answers
const SAMPLE_DRAFT = {
  step_1: { likes: ['pollo', 'huevo', 'arroz', 'avena', 'frutas', 'verduras'] }, // alimentos preferidos (priorizados no plano)
  step_2: { goal: 'perder_peso' }, // perder_peso | mantener | ganar_masa
  step_3: { must_have: 'café por la mañana' },
  step_4: { sex: 'femenino' }, // femenino | masculino
  step_5: { age: 34, weight_kg: 72, height_cm: 165 },
  step_6: { activity_level: 'ligeramente_activo', activity_factor: 1.375 },
  step_8: { restrictions: [] }, // ex: ['sin_lactosa','vegetariano','sin_gluten']
  step_9: { health: ['ninguna_condicion'] },
  step_10: { limitations: ['ninguna'], experience: 'principiante', location: 'casa', frequency: '3_4' },
}

export default async function DevPlanPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const answers = parseAnswers(SAMPLE_DRAFT, 'MX')
  const targets = calcTargets(answers)
  // planWeeks = 4 → plano completo de 4 semanas (abas de fase), o herói da oferta.
  // Troque para 1 se quiser gravar a versão de ciclo semanal.
  const plan = await generateNutritionPlan(answers, targets, 1, undefined, 4)

  const profile = {
    age: answers.age,
    weightKg: answers.weightKg,
    heightCm: answers.heightCm,
    sex: answers.sex,
    activityLevel: 'ligeramente_activo',
  }

  return (
    <div>
      <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-2 text-center text-xs font-semibold text-yellow-900">
        ⚙️ VISTA PREVIA (dev) — plan generado por el stub, sin IA. Edita SAMPLE_DRAFT en el archivo para probar otros perfiles.
      </div>
      <PlanView plan={plan} name="María González" docKinds={['nutrition_plan']} devPdfHref="/dev/plan-pdf" profile={profile} />
    </div>
  )
}
