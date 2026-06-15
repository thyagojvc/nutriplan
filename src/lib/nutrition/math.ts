// =============================================================================
// NutriPlan — Camada determinística (Fase C)
// Toda a aritmética nutricional vive aqui: Mifflin-St Jeor, TDEE, ajuste por
// objetivo, macros e overrides clínicos. NÃO depende de IA — é exata, grátis e
// testável. O gerador (stub/IA) recebe essas metas prontas e só compõe refeições.
//
// Referências (spec produto_v8 §5):
//  - Mifflin-St Jeor; fatores 1,20 / 1,375 / 1,55 / 1,725
//  - Ajuste por objetivo
//  - Gestante = manutenção (sem déficit/superávit)
// =============================================================================

import type { ParsedAnswers, NutritionTargets, GoalType } from './types'

// Ajuste calórico por objetivo (multiplicador sobre o TDEE)
const GOAL_ADJUSTMENT: Record<GoalType, number> = {
  lose_fat: 0.8, // déficit de 20%
  gain_muscle: 1.1, // superávit de 10%
  maintain: 1.0,
  health_energy: 1.0,
}

// Proteína (g por kg de peso) e % de gordura sobre as calorias-alvo, por objetivo.
// Carboidrato é o restante. Valores conservadores e defensáveis clinicamente.
const MACRO_PROFILE: Record<GoalType, { proteinPerKg: number; fatPct: number }> = {
  lose_fat: { proteinPerKg: 2.0, fatPct: 0.25 },
  gain_muscle: { proteinPerKg: 2.0, fatPct: 0.25 },
  maintain: { proteinPerKg: 1.6, fatPct: 0.3 },
  health_energy: { proteinPerKg: 1.6, fatPct: 0.3 },
}

/** Mifflin-St Jeor BMR (kcal/dia). */
export function calcBMR(
  sex: 'male' | 'female',
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

/**
 * Calcula todas as metas nutricionais de forma determinística.
 * Aplica override clínico: gestante força manutenção (sem déficit/superávit).
 */
export function calcTargets(a: ParsedAnswers): NutritionTargets {
  const bmr = calcBMR(a.sex, a.weightKg, a.heightCm, a.age)
  const tdee = bmr * a.activityFactor

  // Override clínico: gestante/lactante = manutenção (spec §5)
  const isPregnant = a.health.includes('pregnant')
  const effectiveGoal: GoalType = isPregnant ? 'maintain' : a.goal
  const clinicalOverrideApplied = isPregnant && a.goal !== 'maintain'

  const targetCalories = Math.round(tdee * GOAL_ADJUSTMENT[effectiveGoal])

  // Macros
  const profile = MACRO_PROFILE[effectiveGoal]
  const proteinG = Math.round(profile.proteinPerKg * a.weightKg)
  const fatG = Math.round((targetCalories * profile.fatPct) / 9)
  const proteinKcal = proteinG * 4
  const fatKcal = fatG * 9
  // carboidrato preenche o restante; nunca negativo
  const carbsKcal = Math.max(0, targetCalories - proteinKcal - fatKcal)
  const carbsG = Math.round(carbsKcal / 4)

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories,
    activityFactor: a.activityFactor,
    goal: effectiveGoal,
    clinicalOverrideApplied,
    macros: { proteinG, carbsG, fatG },
  }
}

// Distribuição de calorias por refeição (4 refeições, soma = 1.0)
export const MEAL_DISTRIBUTION: { name: string; pct: number }[] = [
  { name: 'Desayuno', pct: 0.25 },
  { name: 'Almuerzo', pct: 0.35 },
  { name: 'Cena', pct: 0.3 },
  { name: 'Snack', pct: 0.1 },
]

/**
 * Gera disclaimers clínicos conforme condições de saúde (spec §5).
 * Texto em espanhol regional neutro.
 */
export function clinicalDisclaimers(a: ParsedAnswers): string[] {
  const out: string[] = []
  if (a.health.includes('pregnant')) {
    out.push(
      'Tu plan está calculado para mantenimiento por tu condición de embarazo o lactancia. Consulta a tu médico antes de iniciar cualquier plan nutricional.',
    )
  }
  if (a.health.includes('hypertension')) {
    out.push(
      'Plan con enfoque conservador en sodio por tu hipertensión. Prioriza alimentos frescos y evita ultraprocesados.',
    )
  }
  if (a.health.includes('heart_disease')) {
    out.push(
      'Plan con enfoque conservador por tu condición cardíaca. Consulta a tu cardiólogo antes de cambios importantes en tu alimentación.',
    )
  }
  if (a.health.includes('diabetes')) {
    out.push(
      'Este plan es una orientación general. Si tienes diabetes, ajusta los carbohidratos con tu médico o nutriólogo y monitorea tu glucosa.',
    )
  }
  if (a.health.includes('other')) {
    out.push(
      'Este plan es una orientación general y no sustituye la indicación de un profesional de la salud para tu condición específica.',
    )
  }
  // disclaimer geral sempre presente
  out.push(
    'NutriPlan ofrece orientación nutricional general y no constituye consejo médico. Ante cualquier duda, consulta a un profesional de la salud.',
  )
  return out
}
