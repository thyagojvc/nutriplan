// =============================================================================
// NutriPlan — Gerador de plano nutricional (Fase C)
// generate.ts é o PONTO ÚNICO DE TROCA para a IA.
//
//   generateNutritionPlan()  → hoje chama generatePlanStub()
//                              quando a chave da Anthropic estiver pronta,
//                              trocar por generatePlanAI() (uma linha).
//
// O stub é determinístico: usa as metas calculadas (math.ts) e os favoritos do
// usuário para compor 7 dias coerentes, respeitando exclusões. Não chama IA.
// =============================================================================

import type {
  ParsedAnswers,
  NutritionTargets,
  NutritionPlanJson,
  PlanDay,
  PlanMeal,
  PlanItem,
} from './types'
import { MEAL_DISTRIBUTION, clinicalDisclaimers } from './math'
import {
  CATALOG_BY_LABEL,
  FOOD_CATALOG,
  foodsByRole,
  foodsForMeal,
  type CatalogFood,
  type FoodRole,
  type MealSlot,
} from './food-catalog'

export const PROMPT_VERSION = 'stub-v1'

export type PhaseNumber = 1 | 2 | 3

/** Peso atualizado vindo do check-in, usado na fase 2 para recalcular targets. */
export interface CheckinContext {
  currentWeightKg?: number
  adherenceRating?: number
}

/**
 * Entrada única. Hoje delega ao stub.
 * Para ligar a IA: trocar a linha de retorno por `return generatePlanAI(...)`.
 */
export async function generateNutritionPlan(
  answers: ParsedAnswers,
  targets: NutritionTargets,
  phaseNumber: PhaseNumber = 1,
  checkin?: CheckinContext,
): Promise<NutritionPlanJson> {
  return generatePlanStub(answers, targets, phaseNumber, checkin)
}

// ---------------------------------------------------------------------------
// STUB determinístico
// ---------------------------------------------------------------------------

function isExcluded(foodId: string, exclusions: string[]): boolean {
  return exclusions.includes(foodId)
}

/**
 * Pool de alimentos de um papel adequados a uma refeição, já sem os que o
 * usuário rejeitou (step 1) nem os bloqueados por restrição alimentar (step 8) —
 * ambos chegam em answers.exclusions. A rotação por dia cuida da variedade.
 */
function poolForMeal(
  role: FoodRole,
  meal: MealSlot,
  answers: ParsedAnswers,
): CatalogFood[] {
  return foodsForMeal(meal, role).filter((f) => !isExcluded(f.id, answers.exclusions))
}

/** Escala as porções de uma refeição para bater ~ a meta de kcal. */
function scaleMeal(items: PlanItem[], targetKcal: number): PlanItem[] {
  const rawKcal = items.reduce((s, it) => s + it.kcal, 0)
  if (rawKcal <= 0) return items
  const factor = targetKcal / rawKcal
  return items.map((it) => ({
    ...it,
    quantity: it.quantity,
    kcal: Math.round(it.kcal * factor),
    proteinG: Math.round(it.proteinG * factor),
    carbsG: Math.round(it.carbsG * factor),
    fatG: Math.round(it.fatG * factor),
  }))
}

function itemFrom(food: CatalogFood, grams: number): PlanItem {
  const f = grams / 100
  return {
    food: food.label,
    quantity: `${grams} ${food.unit}`,
    kcal: Math.round(food.kcal * f),
    proteinG: Math.round(food.proteinG * f),
    carbsG: Math.round(food.carbsG * f),
    fatG: Math.round(food.fatG * f),
  }
}

function mealTotals(items: PlanItem[]) {
  return items.reduce(
    (t, it) => ({
      kcal: t.kcal + it.kcal,
      proteinG: t.proteinG + it.proteinG,
      carbsG: t.carbsG + it.carbsG,
      fatG: t.fatG + it.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  )
}

const MEAL_SLOT: Record<string, MealSlot> = {
  Desayuno: 'desayuno',
  Almuerzo: 'almuerzo',
  Cena: 'cena',
  Snack: 'snack',
}

/** Constrói uma refeição para um índice de dia, rotacionando alimentos por variedade. */
function buildMeal(
  mealName: string,
  targetKcal: number,
  answers: ParsedAnswers,
  dayIndex: number,
): PlanMeal {
  const slot = MEAL_SLOT[mealName] ?? 'almuerzo'

  // Rotação por dia: cada dia avança no pool → menos repetição ao longo da semana.
  const rotate = <T,>(arr: T[], offset: number): T | null =>
    arr.length === 0 ? null : arr[(dayIndex + offset) % arr.length]

  const items: PlanItem[] = []

  if (slot === 'desayuno') {
    // café da manhã: carbo de manhã (avena/pan/tortilla) + proteína leve (huevo/lácteo) + fruta
    const carb = rotate(poolForMeal('carb', slot, answers), 0)
    const protPool = [...poolForMeal('protein', slot, answers), ...poolForMeal('dairy', slot, answers)]
    const prot = rotate(protPool, 0)
    const fruit = rotate(poolForMeal('fruit', slot, answers), 0)
    if (carb) items.push(itemFrom(carb, 60))
    if (prot) items.push(itemFrom(prot, 80))
    if (fruit) items.push(itemFrom(fruit, 120))
  } else if (slot === 'snack') {
    // lanche: fruta ou laticínio + gordura boa
    const snackPool = [...poolForMeal('fruit', slot, answers), ...poolForMeal('dairy', slot, answers)]
    const snack = rotate(snackPool, 1)
    const fat = rotate(poolForMeal('fat', slot, answers), 0)
    if (snack) items.push(itemFrom(snack, 120))
    if (fat) items.push(itemFrom(fat, 25))
  } else {
    // almuerzo / cena: proteína + carbo + vegetais. Offset distingue almoço de jantar
    // para não repetir a mesma proteína/carbo no mesmo dia.
    const offset = slot === 'cena' ? 2 : 0
    const prot = rotate(poolForMeal('protein', slot, answers), offset)
    const carb = rotate(poolForMeal('carb', slot, answers), offset + 1)
    const veg = rotate(poolForMeal('veg', slot, answers), offset + 2)
    if (prot) items.push(itemFrom(prot, 150))
    if (carb) items.push(itemFrom(carb, 120))
    if (veg) items.push(itemFrom(veg, 150))
  }

  // garante ao menos 1 item (fallback se restrições zeraram o pool da refeição)
  if (items.length === 0) {
    const anyFood =
      FOOD_CATALOG.find((f) => f.meals.includes(slot) && !isExcluded(f.id, answers.exclusions)) ??
      FOOD_CATALOG.find((f) => !isExcluded(f.id, answers.exclusions))
    if (anyFood) items.push(itemFrom(anyFood, 100))
  }

  const scaled = scaleMeal(items, targetKcal)
  return {
    name: mealName,
    targetKcal,
    items: scaled,
    totals: mealTotals(scaled),
  }
}

function buildDay(dayNum: number, answers: ParsedAnswers, targetKcal: number): PlanDay {
  const meals = MEAL_DISTRIBUTION.map((m) =>
    buildMeal(m.name, Math.round(targetKcal * m.pct), answers, dayNum - 1),
  )
  const totals = meals.reduce(
    (t, m) => ({
      kcal: t.kcal + m.totals.kcal,
      proteinG: t.proteinG + m.totals.proteinG,
      carbsG: t.carbsG + m.totals.carbsG,
      fatG: t.fatG + m.totals.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  )
  return { day: dayNum, label: `Día ${dayNum}`, meals, totals }
}

/** Lista de compras derivada dos alimentos que realmente aparecem no plano. */
function buildShoppingList(days: PlanDay[]): NutritionPlanJson['shoppingList'] {
  const usedLabels = new Set<string>()
  for (const d of days) {
    for (const m of d.meals) {
      for (const it of m.items) usedLabels.add(it.food)
    }
  }
  const byCat: Record<string, { name: string; quantity: string }[]> = {
    Proteínas: [],
    Carbohidratos: [],
    'Verduras y frutas': [],
    'Grasas y otros': [],
  }
  for (const label of usedLabels) {
    const f = CATALOG_BY_LABEL[label]
    if (!f) continue
    const cat =
      f.role === 'protein' || f.role === 'dairy'
        ? 'Proteínas'
        : f.role === 'carb'
          ? 'Carbohidratos'
          : f.role === 'veg' || f.role === 'fruit'
            ? 'Verduras y frutas'
            : 'Grasas y otros'
    byCat[cat].push({ name: f.label, quantity: 'según tu plan semanal' })
  }
  return Object.entries(byCat)
    .filter(([, items]) => items.length > 0)
    .map(([category, items]) => ({ category, items }))
}

function buildSubstitutions(answers: ParsedAnswers): NutritionPlanJson['substitutions'] {
  const out: NutritionPlanJson['substitutions'] = []
  for (const role of ['protein', 'carb'] as const) {
    const pool = foodsByRole(role).filter((f) => !isExcluded(f.id, answers.exclusions))
    if (pool.length >= 2) {
      out.push({
        food: pool[0].label,
        alternatives: pool.slice(1, 4).map((f) => f.label),
      })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Plano de treino (condicional ao order bump) — stub mínimo
// ---------------------------------------------------------------------------

export interface TrainingPlanJson {
  summary: { experience: string; location: string; frequency: string; notes: string[] }
  days: { label: string; focus: string; exercises: { name: string; sets: string }[] }[]
  disclaimers: string[]
  generatedBy: 'stub' | 'ai'
  promptVersion: string
}

const LIMITATION_ADVICE: Record<string, string> = {
  knee: 'Evita sentadillas profundas e impacto; prioriza prensa y extensiones controladas.',
  lower_back: 'Evita peso muerto convencional; refuerza el core y cuida la postura.',
  shoulder: 'Evita press por encima de la cabeza con carga alta; trabaja rango cómodo.',
  other: 'Adapta los ejercicios a tu rango de movimiento sin dolor.',
}

export async function generateTrainingPlan(
  answers: ParsedAnswers,
): Promise<TrainingPlanJson> {
  const t = answers.training
  const focuses =
    t.frequency === '5_mas'
      ? ['Tren superior', 'Tren inferior', 'Empuje', 'Tracción', 'Full body']
      : t.frequency === '3_4'
        ? ['Tren superior', 'Tren inferior', 'Full body']
        : ['Full body A', 'Full body B']

  const days = focuses.map((focus, i) => ({
    label: `Sesión ${i + 1}`,
    focus,
    exercises: [
      { name: 'Calentamiento dinámico', sets: '5–8 min' },
      { name: 'Ejercicio compuesto principal', sets: '4 x 8–10' },
      { name: 'Accesorio 1', sets: '3 x 12' },
      { name: 'Accesorio 2', sets: '3 x 12' },
      { name: 'Core / estiramiento', sets: '3 x 30 s' },
    ],
  }))

  const notes: string[] = []
  for (const lim of answers.training.limitations) {
    if (lim !== 'none' && LIMITATION_ADVICE[lim]) notes.push(LIMITATION_ADVICE[lim])
  }

  return {
    summary: {
      experience: t.experience ?? 'principiante',
      location: t.location ?? 'casa',
      frequency: t.frequency ?? '3_4',
      notes,
    },
    days,
    disclaimers: [
      'Consulta a un profesional antes de iniciar un programa de ejercicio, especialmente si tienes alguna condición médica.',
    ],
    generatedBy: 'stub',
    promptVersion: PROMPT_VERSION,
  }
}

// ---------------------------------------------------------------------------
// Ajustes por fase
// ---------------------------------------------------------------------------

const PHASE_CALORIE_MULTIPLIER: Record<PhaseNumber, number> = {
  1: 1.00, // Fase 1: deficit original do calcTargets (já aplicado)
  2: 0.97, // Fase 2: aperta ligeiramente se aderência foi boa
  3: 1.08, // Fase 3: sobe em direção à manutenção (reduz deficit)
}

const PHASE_NOTES: Record<PhaseNumber, string[]> = {
  1: [
    'Fase 1 — Adaptación: el objetivo es que tu cuerpo se acostumbre al nuevo ritmo alimentario.',
    'No busques resultados drásticos todavía — la consistencia en estas 4 semanas es lo que importa.',
  ],
  2: [
    'Fase 2 — Aceleración: ajustamos tus calorías y proteínas con base en tu progreso real.',
    'Aumentamos ligeramente la proteína para proteger tu masa muscular mientras aceleras los resultados.',
  ],
  3: [
    'Fase 3 — Consolidación: comenzamos a acercarnos a tu metabolismo de mantenimiento.',
    'El objetivo ahora es que los hábitos sean sostenibles a largo plazo, no solo a corto plazo.',
  ],
}

const PHASE_GUIDE: Record<PhaseNumber, string[]> = {
  1: [
    'Prepara tus proteínas y carbohidratos en lote 2 veces por semana para ahorrar tiempo.',
    'Bebe al menos 2 litros de agua al día.',
    'Respeta los horarios de tus comidas para mantener tu energía estable.',
    'Usa la lista de sustituciones cuando quieras variar sin salir de tus metas.',
    'Pésate una vez por semana, en ayunas, para seguir tu progreso.',
  ],
  2: [
    'Mantén la proteína como prioridad: asegura tu porción en cada comida principal.',
    'Si sientes hambre entre comidas, aumenta las verduras — aportan volumen sin calorías.',
    'Registra tu peso cada lunes en ayunas y compáralo con el mes anterior.',
    'No saltes el Snack: ayuda a controlar el apetito en la cena.',
    'Presta atención a cómo te sientes con energía — eso es señal de que el ajuste funciona.',
  ],
  3: [
    'Estamos en fase de consolidación: el plan es más flexible, pero la estructura sigue siendo clave.',
    'Puedes introducir una "comida libre" a la semana sin afectar tus resultados.',
    'Enfócate en el tiempo de las comidas, no solo en las cantidades.',
    'Sigue pesándote semanalmente — ahora el objetivo es mantener, no solo bajar.',
    'Piensa en este plan como tu nuevo estilo de vida, no como una dieta temporal.',
  ],
}

function applyPhaseToTargets(
  targets: NutritionTargets,
  phase: PhaseNumber,
  checkin?: CheckinContext,
): number {
  let base = targets.targetCalories

  // Fase 2: se aderência foi baixa (≤2), não aperta mais; se boa (≥4), aperta um pouco
  if (phase === 2 && checkin?.adherenceRating) {
    const multiplier = checkin.adherenceRating >= 4
      ? PHASE_CALORIE_MULTIPLIER[2]
      : 1.00 // sem ajuste se aderência fraca
    base = Math.round(base * multiplier)
  } else {
    base = Math.round(base * PHASE_CALORIE_MULTIPLIER[phase])
  }

  return base
}

function generatePlanStub(
  answers: ParsedAnswers,
  targets: NutritionTargets,
  phase: PhaseNumber = 1,
  checkin?: CheckinContext,
): NutritionPlanJson {
  const targetCalories = applyPhaseToTargets(targets, phase, checkin)

  const days: PlanDay[] = Array.from({ length: 7 }, (_, i) =>
    buildDay(i + 1, answers, targetCalories),
  )

  const notes: string[] = [...PHASE_NOTES[phase]]
  if (targets.clinicalOverrideApplied) {
    notes.push('Tus calorías se ajustaron a mantenimiento por tu condición de salud.')
  }
  if (answers.mustHave) {
    notes.push(`Incluimos tu alimento imprescindible: ${answers.mustHave}.`)
  }
  notes.push(
    'Este es tu ciclo de 7 días, repetible durante 4 semanas. Varía las opciones usando la lista de sustituciones.',
  )

  return {
    summary: {
      bmr: targets.bmr,
      tdee: targets.tdee,
      targetCalories,
      activityFactor: targets.activityFactor,
      goal: targets.goal,
      macros: targets.macros,
      cycleDays: 7,
      cycleWeeks: 4,
      notes,
    },
    days,
    shoppingList: buildShoppingList(days),
    implementationGuide: PHASE_GUIDE[phase],
    substitutions: buildSubstitutions(answers),
    disclaimers: clinicalDisclaimers(answers),
    generatedBy: 'stub',
    promptVersion: PROMPT_VERSION,
  }
}
