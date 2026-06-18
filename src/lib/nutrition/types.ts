// =============================================================================
// NutriPlan — Tipos da geração de plano nutricional (Fase C)
// types.ts: formato das respostas normalizadas + formato do plan_json.
// O plan_json é a fonte de verdade do conteúdo (migration 0006). É o que o
// gerador (stub ou IA) produz e o que o dashboard renderiza.
// =============================================================================

// ----- Enums do banco (migration 0001) -----
export type SexBiological = 'male' | 'female'
export type GoalType = 'lose_fat' | 'gain_muscle' | 'maintain' | 'health_energy'
export type HealthCondition =
  | 'none'
  | 'pregnant'
  | 'hypertension'
  | 'heart_disease'
  | 'diabetes'
  | 'other'
export type PhysicalLimitation =
  | 'none'
  | 'knee'
  | 'lower_back'
  | 'shoulder'
  | 'wrist_elbow'
  | 'varicose'
  | 'other'

// ----- Respostas do quiz normalizadas (a partir de draft_answers) -----
export interface ParsedAnswers {
  dislikes: string[] // ids dos alimentos que o usuário NÃO gosta/come (step 1) → viram exclusões
  goal: GoalType // step 2
  mustHave: string | null // step 3 (texto livre)
  sex: SexBiological // step 4
  age: number // step 5
  weightKg: number // step 5
  heightCm: number // step 5
  activityFactor: number // step 6 (1.2 | 1.375 | 1.55 | 1.725)
  country: string // step 7
  restrictions: string[] // step 8 (ids em espanhol)
  health: HealthCondition[] // step 9 mapeado para enum
  // Treino (step 10) — usado apenas se houver order bump de treino
  training: {
    experience: string | null
    location: string | null
    frequency: string | null
    limitations: PhysicalLimitation[]
  }
  // Lista de alimentos/categorias a excluir, derivada das restrições
  exclusions: string[]
  generalGuidance: boolean // diabetes/outra => true (migration 0006)
}

// ----- Resultado da matemática determinística -----
export interface NutritionTargets {
  bmr: number
  tdee: number
  targetCalories: number
  activityFactor: number
  goal: GoalType
  // se override clínico aplicado (ex.: gestante força manutenção)
  clinicalOverrideApplied: boolean
  macros: {
    proteinG: number
    carbsG: number
    fatG: number
  }
}

// ----- Formato do plan_json (nutrição) -----
export interface PlanItem {
  food: string
  quantity: string // medida caseira / porção legível
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface PlanMeal {
  name: string // Desayuno, Almuerzo, Cena, Snack
  targetKcal: number
  items: PlanItem[]
  totals: { kcal: number; proteinG: number; carbsG: number; fatG: number }
}

export interface PlanDay {
  day: number // 1..7
  label: string // "Día 1"
  meals: PlanMeal[]
  totals: { kcal: number; proteinG: number; carbsG: number; fatG: number }
}

export interface ShoppingCategory {
  category: string
  items: { name: string; quantity: string }[]
}

export interface SubstitutionGroup {
  food: string
  alternatives: string[]
}

export interface NutritionPlanJson {
  summary: {
    bmr: number
    tdee: number
    targetCalories: number
    activityFactor: number
    goal: GoalType
    macros: { proteinG: number; carbsG: number; fatG: number }
    cycleDays: number // 7
    cycleWeeks: number // 4
    notes: string[]
  }
  days: PlanDay[]
  shoppingList: ShoppingCategory[]
  implementationGuide: string[]
  substitutions: SubstitutionGroup[]
  disclaimers: string[]
  // metadados de geração
  generatedBy: 'stub' | 'ai'
  promptVersion: string
}
