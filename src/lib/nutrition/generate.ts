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
  CATALOG_BY_ID,
  CATALOG_BY_LABEL,
  FOOD_CATALOG,
  foodsByRole,
  foodsForMeal,
  formatHomeMeasure,
  type CatalogFood,
  type FoodRole,
  type MealSlot,
} from './food-catalog'

export const PROMPT_VERSION = 'stub-v2'

// Alimentos típicos por país — entram na rotação como segunda prioridade
// (depois dos favoritos do usuário, antes dos genéricos)
const COUNTRY_STAPLE_IDS: Record<string, string[]> = {
  MX: ['tortilla_maiz', 'legumbres', 'arroz', 'nopales', 'aguacate'],
  CO: ['arepa', 'arroz', 'platano', 'yuca', 'legumbres'],
  CL: ['pan', 'arroz', 'papa', 'aguacate'],
  ES: ['pan', 'arroz', 'legumbres', 'pescado', 'aceite'],
}

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
  planWeeks: 1 | 4 = 1,
): Promise<NutritionPlanJson> {
  return generatePlanStub(answers, targets, phaseNumber, checkin, planWeeks)
}

// ---------------------------------------------------------------------------
// STUB determinístico
// ---------------------------------------------------------------------------

function isExcluded(foodId: string, exclusions: string[]): boolean {
  return exclusions.includes(foodId)
}

// Mínimo de opções por papel/refeição para a rotação não repetir os mesmos
// dias. Se os preferidos não chegam a esse número, completamos com outros
// alimentos permitidos (preferidos sempre primeiro) só até atingir o mínimo.
const MIN_VARIETY = 3

/**
 * Pool de alimentos de um papel adequados a uma refeição.
 *
 * 1) Remove os bloqueados por restrição alimentar (step 8) — answers.exclusions.
 * 2) Prioriza os preferidos (step 1) que se encaixam neste papel/refeição.
 *    - Se o usuário tem >= MIN_VARIETY preferidos aqui, usa SOMENTE eles.
 *    - Se tem 1–2, completa com outros permitidos (preferidos primeiro) até
 *      MIN_VARIETY, garantindo variedade na semana sem perder o reforço positivo.
 *    - Se não marcou nenhum deste papel, usa o pool completo disponível.
 *
 * O fallback também garante que nenhuma refeição fique vazia.
 */
function poolForMeal(
  role: FoodRole,
  meal: MealSlot,
  answers: ParsedAnswers,
): CatalogFood[] {
  const available = foodsForMeal(meal, role).filter((f) => !isExcluded(f.id, answers.exclusions))
  const liked = available.filter((f) => answers.likes.includes(f.id))

  if (liked.length >= MIN_VARIETY) return liked

  // Staples do país como segunda prioridade — depois dos favoritos, antes dos genéricos
  const stapleIds = COUNTRY_STAPLE_IDS[answers.country] ?? []
  const staples = available.filter((f) => stapleIds.includes(f.id) && !answers.likes.includes(f.id))
  const others = available.filter((f) => !answers.likes.includes(f.id) && !stapleIds.includes(f.id))

  const combined = [...liked, ...staples, ...others]
  return combined.length > 0 ? combined : available
}

// Ingrediente antes de fechar a porção: guarda o alimento e a grama base.
type RawItem = { food: CatalogFood; grams: number }

/** Converte gramas finais num item exibível: gramas + medida caseira + macros. */
function itemFrom(food: CatalogFood, grams: number): PlanItem {
  const f = grams / 100
  return {
    food: food.label,
    quantity: `${grams} g · ${formatHomeMeasure(grams, food.home)}`,
    kcal: Math.round(food.kcal * f),
    proteinG: Math.round(food.proteinG * f),
    carbsG: Math.round(food.carbsG * f),
    fatG: Math.round(food.fatG * f),
  }
}

// Teto de gramas por alimento — impede porções irreais que denunciam geração
// automática (5 ovos num prato, ¼ de litro de azeite, 2½ latas de atún).
// Um nutricionista nunca escreveria isso à mão.
const GRAM_CAP_BY_ID: Record<string, number> = {
  huevo: 150,        // ≈3 huevos — máximo razoável en una comida
  aceite: 20,        // ≈1½ cucharada
  nueces: 45,
  aguacate: 100,
  granola: 80,
  atun: 165,         // ≈1⅓ lata
  queso_fresco: 120,
}
const GRAM_CAP_BY_ROLE: Record<FoodRole, number> = {
  protein: 240, carb: 260, veg: 220, fruit: 220, fat: 45, dairy: 300,
}
function gramCap(food: CatalogFood): number {
  return GRAM_CAP_BY_ID[food.id] ?? GRAM_CAP_BY_ROLE[food.role]
}

/**
 * Fecha uma refeição: escala as GRAMAS para bater ~ a meta de kcal, mas
 * respeitando um TETO realista por alimento. Quando um ingrediente bate o teto,
 * a kcal que faltaria é redistribuída entre os outros itens com folga — assim a
 * meta calórica é mantida sem inflar um único alimento a uma porção absurda.
 */
function finalizeMeal(name: string, raw: RawItem[], targetKcal: number): PlanMeal {
  const baseKcal = raw.reduce((s, r) => s + (r.food.kcal * r.grams) / 100, 0)
  const factor = baseKcal > 0 ? targetKcal / baseKcal : 1

  // 1ª passada: escala por kcal, mas nunca acima do teto do alimento
  const scaled = raw.map((r) => {
    const want = Math.max(10, r.grams * factor)
    const cap = gramCap(r.food)
    return { food: r.food, grams: Math.min(want, cap) }
  })

  // Redistribui a kcal que faltou para os itens que ainda têm folga até o teto
  const kcalOf = (g: number, f: CatalogFood) => (f.kcal * g) / 100
  let deficit = targetKcal - scaled.reduce((s, x) => s + kcalOf(x.grams, x.food), 0)
  for (let pass = 0; pass < 4 && deficit > 1; pass++) {
    const flexible = scaled.filter((x) => x.food.kcal > 0 && x.grams < gramCap(x.food))
    if (flexible.length === 0) break
    const share = deficit / flexible.length
    for (const x of flexible) {
      const target = Math.min(x.grams + (share * 100) / x.food.kcal, gramCap(x.food))
      deficit -= kcalOf(target - x.grams, x.food)
      x.grams = target
    }
  }

  const items = scaled.map((x) => itemFrom(x.food, Math.max(10, Math.round(x.grams / 5) * 5)))
  return { name, targetKcal, items, totals: mealTotals(items) }
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

// Proteínas com baixa densidade proteica (<18 g/100 g): sozinhas não fecham a
// meta de proteína sem virar porção irreal. Um nutricionista combina com huevo
// ou queso — frijoles con huevo, lentejas con queso. Autêntico e sobe a proteína.
const LOW_DENSITY_PROTEIN = 18

/**
 * Gramas-base de uma proteína para mirar ~targetProtG de proteína do item,
 * limitado a [110, maxG] para não criar porções irreais. Proteínas magras e
 * densas (pollo, atún, pavo) recebem menos gramas; as mais leves, mais.
 */
function proteinBaseGrams(food: CatalogFood, targetProtG: number, maxG: number): number {
  if (food.proteinG <= 0) return 150
  const g = (targetProtG * 100) / food.proteinG
  return Math.round(Math.min(Math.max(g, 110), maxG))
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

  const raw: RawItem[] = []

  if (slot === 'desayuno') {
    // café da manhã: carbo de manhã (avena/pan/tortilla) + proteína leve (huevo/lácteo) + fruta
    const carb = rotate(poolForMeal('carb', slot, answers), 0)
    const protPool = [...poolForMeal('protein', slot, answers), ...poolForMeal('dairy', slot, answers)]
    const prot = rotate(protPool, 0)
    const fruit = rotate(poolForMeal('fruit', slot, answers), 0)
    if (carb) raw.push({ food: carb, grams: 55 })
    if (prot) raw.push({ food: prot, grams: proteinBaseGrams(prot, 18, 150) })
    if (fruit) raw.push({ food: fruit, grams: 120 })
  } else if (slot === 'snack') {
    // lanche: fruta ou laticínio + gordura boa
    const snackPool = [...poolForMeal('fruit', slot, answers), ...poolForMeal('dairy', slot, answers)]
    const snack = rotate(snackPool, 1)
    const fat = rotate(poolForMeal('fat', slot, answers), 0)
    if (snack) raw.push({ food: snack, grams: 120 })
    if (fat) raw.push({ food: fat, grams: 25 })
  } else {
    // almuerzo / cena: proteína + carbo + vegetais. Offset distingue almoço de jantar
    // para não repetir a mesma proteína/carbo no mesmo dia.
    const offset = slot === 'cena' ? 2 : 0
    const prot = rotate(poolForMeal('protein', slot, answers), offset)
    const carb = rotate(poolForMeal('carb', slot, answers), offset + 1)
    const veg = rotate(poolForMeal('veg', slot, answers), offset + 2)
    if (prot) {
      raw.push({ food: prot, grams: proteinBaseGrams(prot, 45, 230) })
      // Proteína vegetal pobre → complementa com huevo/queso para fechar a
      // proteína do prato de forma realista (combinación clásica).
      if (prot.proteinG < LOW_DENSITY_PROTEIN) {
        const compPool = [CATALOG_BY_ID['huevo'], CATALOG_BY_ID['queso_fresco']]
          .filter((f) => f && !isExcluded(f.id, answers.exclusions) && f.id !== prot.id)
        const comp = rotate(compPool, offset)
        if (comp) raw.push({ food: comp, grams: comp.id === 'huevo' ? 100 : 60 })
      }
    }
    if (carb) raw.push({ food: carb, grams: 95 })
    if (veg) raw.push({ food: veg, grams: 150 })
  }

  // garante ao menos 1 item (fallback se restrições zeraram o pool da refeição)
  if (raw.length === 0) {
    const anyFood =
      FOOD_CATALOG.find((f) => f.meals.includes(slot) && !isExcluded(f.id, answers.exclusions)) ??
      FOOD_CATALOG.find((f) => !isExcluded(f.id, answers.exclusions))
    if (anyFood) raw.push({ food: anyFood, grams: 100 })
  }

  return finalizeMeal(mealName, raw, targetKcal)
}

function buildDay(dayNum: number, answers: ParsedAnswers, targetKcal: number, label?: string): PlanDay {
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
  return { day: dayNum, label: label ?? `Día ${dayNum}`, meals, totals }
}

// ---------------------------------------------------------------------------
// Amostra para a vista previa (pré-compra)
// ---------------------------------------------------------------------------

export interface SampleMealItem {
  food: string
  qty: string
  proteinG: number
  carbsG: number
  fatG: number
}
export interface SampleMeal {
  name: string
  kcal: number
  items: SampleMealItem[]
}
export interface PreviewSample {
  meals: SampleMeal[]
  /** true se o usuário marcou favoritos no step 1 (refeições personalizadas);
   *  false = montada com alimentos comuns/confiáveis de fallback. */
  personalized: boolean
}

/**
 * Amostra determinística (stub) das 2 primeiras refeições do Día 1 — o que o
 * teaser da /preview mostra. Reusa a MESMA lógica do plano real (poolForMeal):
 * prioriza os favoritos do usuário e completa com alimentos comuns quando não
 * há favoritos suficientes para a refeição, respeitando restrições. kcal,
 * macros e adequação ao horário ficam coerentes com o plano entregue.
 *
 * Sempre via stub: a vista previa é grátis e instantânea, nunca chama a IA.
 */
export function buildPreviewSample(
  answers: ParsedAnswers,
  targets: NutritionTargets,
): PreviewSample {
  const kcal = targets.targetCalories

  // No teaser mostramos SEMPRE o topo de cada pool (poolForMeal já coloca os
  // favoritos primeiro) — sem a rotação por dia do plano real — para que as
  // refeições visíveis destaquem os alimentos que a pessoa escolheu. Fallback a
  // comuns quando não há favoritos, e a qualquer alimento permitido se restrições
  // zerarem o pool. Reusa finalizeMeal → kcal/macros coerentes com o plano real.
  const top = (pool: CatalogFood[]): CatalogFood | null => pool[0] ?? null

  function sampleMeal(name: string, slot: MealSlot, targetKcal: number): SampleMeal {
    const raw: RawItem[] = []
    if (slot === 'desayuno') {
      const carb = top(poolForMeal('carb', slot, answers))
      const prot = top([...poolForMeal('protein', slot, answers), ...poolForMeal('dairy', slot, answers)])
      const fruit = top(poolForMeal('fruit', slot, answers))
      if (carb) raw.push({ food: carb, grams: 60 })
      if (prot) raw.push({ food: prot, grams: 80 })
      if (fruit) raw.push({ food: fruit, grams: 120 })
    } else {
      const prot = top(poolForMeal('protein', slot, answers))
      const carb = top(poolForMeal('carb', slot, answers))
      const veg = top(poolForMeal('veg', slot, answers))
      if (prot) raw.push({ food: prot, grams: 150 })
      if (carb) raw.push({ food: carb, grams: 120 })
      if (veg) raw.push({ food: veg, grams: 150 })
    }
    if (raw.length === 0) {
      const any = FOOD_CATALOG.find((f) => f.meals.includes(slot) && !isExcluded(f.id, answers.exclusions))
      if (any) raw.push({ food: any, grams: 100 })
    }
    const m = finalizeMeal(name, raw, targetKcal)
    return {
      name: m.name,
      kcal: m.totals.kcal,
      items: m.items.map((it) => ({
        food: it.food,
        qty: it.quantity,
        proteinG: it.proteinG,
        carbsG: it.carbsG,
        fatG: it.fatG,
      })),
    }
  }

  const meals: SampleMeal[] = [
    sampleMeal('Desayuno', 'desayuno', Math.round(kcal * MEAL_DISTRIBUTION[0].pct)),
    sampleMeal('Almuerzo', 'almuerzo', Math.round(kcal * MEAL_DISTRIBUTION[1].pct)),
  ]
  return { meals, personalized: answers.likes.length > 0 }
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
    const available = foodsByRole(role).filter((f) => !isExcluded(f.id, answers.exclusions))
    // Preferidos primeiro, para que as sugestões reflitam o que o usuário gosta.
    const liked = available.filter((f) => answers.likes.includes(f.id))
    const rest = available.filter((f) => !answers.likes.includes(f.id))
    const pool = [...liked, ...rest]
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
  planWeeks: 1 | 4 = 1,
): NutritionPlanJson {
  const totalDays = planWeeks === 4 ? 28 : 7

  const days: PlanDay[] = Array.from({ length: totalDays }, (_, i) => {
    // 4-week: semanas 1-2 → fase 1 (adaptação), semana 3 → fase 2 (aceleração), semana 4 → fase 3 (consolidação)
    const effectivePhase: PhaseNumber = planWeeks === 4
      ? (i < 14 ? 1 : i < 21 ? 2 : 3)
      : phase
    const kcal = applyPhaseToTargets(targets, effectivePhase, checkin)
    const weekNum = Math.floor(i / 7) + 1
    const dayInWeek = (i % 7) + 1
    const label = planWeeks === 4 ? `Sem ${weekNum} · D${dayInWeek}` : `Día ${i + 1}`
    return buildDay(i + 1, answers, kcal, label)
  })

  const baseCalories = applyPhaseToTargets(targets, planWeeks === 4 ? 1 : phase, checkin)

  const notes: string[] = planWeeks === 4
    ? [
        'Semana 1 — Adaptación: tu cuerpo se ajusta al nuevo ritmo alimentario.',
        'Semana 2 — Calibración: el plan empieza a calibrarse a tu metabolismo real.',
        'Semana 3 — Aceleración: las calorías se ajustan ligeramente para impulsar tus resultados.',
        'Semana 4 — Consolidación: nos acercamos a tu metabolismo de mantenimiento para que los hábitos sean duraderos.',
      ]
    : [...PHASE_NOTES[phase]]

  if (targets.clinicalOverrideApplied) {
    notes.push('Tus calorías se ajustaron a mantenimiento por tu condición de salud.')
  }
  if (answers.mustHave) {
    notes.push(`Incluimos tu alimento imprescindible: ${answers.mustHave}.`)
  }
  if (planWeeks === 1) {
    notes.push(
      'Este es tu ciclo de 7 días, repetible durante 4 semanas. Varía las opciones usando la lista de sustituciones.',
    )
  }

  const implementationGuide = planWeeks === 4
    ? [
        ...PHASE_GUIDE[1],
        ...PHASE_GUIDE[2].slice(0, 2),
        ...PHASE_GUIDE[3].slice(0, 2),
      ]
    : PHASE_GUIDE[phase]

  return {
    summary: {
      bmr: targets.bmr,
      tdee: targets.tdee,
      targetCalories: baseCalories,
      activityFactor: targets.activityFactor,
      goal: targets.goal,
      macros: targets.macros,
      cycleDays: totalDays,
      cycleWeeks: 4,
      notes,
    },
    days,
    shoppingList: buildShoppingList(days),
    implementationGuide,
    substitutions: buildSubstitutions(answers),
    disclaimers: clinicalDisclaimers(answers),
    generatedBy: 'stub',
    promptVersion: PROMPT_VERSION,
  }
}
