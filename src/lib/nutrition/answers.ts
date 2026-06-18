// =============================================================================
// NutriPlan — Parsing e normalização das respostas do quiz (Fase C)
// Lê generation_sessions.draft_answers (jsonb com chaves step_1..step_12),
// mapeia ids em espanhol para os enums do banco e deriva a lista de exclusões.
// =============================================================================

import type {
  ParsedAnswers,
  GoalType,
  SexBiological,
  HealthCondition,
  PhysicalLimitation,
} from './types'

type Draft = Record<string, unknown>

function step(draft: Draft, n: number): Record<string, unknown> {
  const v = draft[`step_${n}`]
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}

// ----- Mapeamentos ES (quiz) → enum (banco) -----
const GOAL_MAP: Record<string, GoalType> = {
  perder_peso: 'lose_fat',
  ganar_masa: 'gain_muscle',
  mantener: 'maintain',
}

const SEX_MAP: Record<string, SexBiological> = {
  masculino: 'male',
  femenino: 'female',
}

const HEALTH_MAP: Record<string, HealthCondition> = {
  ninguna_condicion: 'none',
  embarazada: 'pregnant',
  hipertension: 'hypertension',
  enfermedad_cardiaca: 'heart_disease',
  diabetes: 'diabetes',
  otra_condicion: 'other',
}

const LIMITATION_MAP: Record<string, PhysicalLimitation> = {
  ninguna: 'none',
  rodillas: 'knee',
  espalda: 'lower_back',
  hombros: 'shoulder',
  cadera: 'other', // enum não tem hip → other
  cuello: 'other', // enum não tem neck → other
  otra: 'other',
}

// Restrições alimentares → categorias/alimentos a excluir do plano.
// Usado tanto na prevenção (instrução ao gerador) quanto na validação.
const RESTRICTION_EXCLUSIONS: Record<string, string[]> = {
  vegetariano: ['pollo', 'carne_res', 'cerdo', 'pescado', 'mariscos'],
  vegano: [
    'pollo',
    'carne_res',
    'cerdo',
    'pescado',
    'mariscos',
    'huevo',
    'lacteos',
  ],
  sin_gluten: ['pasta', 'pan', 'avena'], // avena: contaminação cruzada comum
  sin_lactosa: ['lacteos'],
  sin_mariscos: ['mariscos'],
  sin_cerdo: ['cerdo'],
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function asNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : NaN
}

/**
 * Normaliza draft_answers em ParsedAnswers tipado.
 * Lança erro se faltarem dados essenciais para o cálculo nutricional.
 */
export function parseAnswers(draft: Draft, country: string): ParsedAnswers {
  const s1 = step(draft, 1)
  const s2 = step(draft, 2)
  const s3 = step(draft, 3)
  const s4 = step(draft, 4)
  const s5 = step(draft, 5)
  const s6 = step(draft, 6)
  const s8 = step(draft, 8)
  const s9 = step(draft, 9)
  const s10 = step(draft, 10)

  const goal = GOAL_MAP[String(s2.goal)] ?? 'maintain'
  const sex = SEX_MAP[String(s4.sex)] ?? 'female'
  const age = asNumber(s5.age)
  const weightKg = asNumber(s5.weight_kg)
  const heightCm = asNumber(s5.height_cm)
  const activityFactor = asNumber(s6.activity_factor)

  // dados essenciais para Mifflin-St Jeor
  if (
    !Number.isFinite(age) ||
    !Number.isFinite(weightKg) ||
    !Number.isFinite(heightCm) ||
    !Number.isFinite(activityFactor)
  ) {
    throw new Error(
      `dados físicos incompletos: age=${age} weight=${weightKg} height=${heightCm} factor=${activityFactor}`,
    )
  }

  const restrictions = asStringArray(s8.restrictions)
  const healthRaw = asStringArray(s9.health)
  const health: HealthCondition[] =
    healthRaw.length === 0
      ? ['none']
      : healthRaw.map((h) => HEALTH_MAP[h] ?? 'other')

  // alimentos que o usuário marcou como "no me gusta" no step 1
  const dislikes = asStringArray(s1.dislikes)

  // exclusões = restrições alimentares (step 8) + alimentos rejeitados (step 1)
  const exclusionSet = new Set<string>()
  for (const r of restrictions) {
    for (const ex of RESTRICTION_EXCLUSIONS[r] ?? []) exclusionSet.add(ex)
  }
  for (const d of dislikes) exclusionSet.add(d)

  // diabetes ou "outra" condição → orientação geral (migration 0006)
  const generalGuidance = health.includes('diabetes') || health.includes('other')

  const limitationsRaw = asStringArray(s10.limitations)
  const limitations: PhysicalLimitation[] =
    limitationsRaw.length === 0
      ? ['none']
      : limitationsRaw.map((l) => LIMITATION_MAP[l] ?? 'other')

  return {
    dislikes,
    goal,
    mustHave: typeof s3.must_have === 'string' ? s3.must_have : null,
    sex,
    age,
    weightKg,
    heightCm,
    activityFactor,
    country,
    restrictions,
    health,
    training: {
      experience: typeof s10.experience === 'string' ? s10.experience : null,
      location: typeof s10.location === 'string' ? s10.location : null,
      frequency: typeof s10.frequency === 'string' ? s10.frequency : null,
      limitations,
    },
    exclusions: Array.from(exclusionSet),
    generalGuidance,
  }
}
