// =============================================================================
// NutriPlan — Catálogo de alimentos (Fase C)
// Base de dados mínima para o gerador stub compor refeições coerentes.
// Macros por 100 g (cru/padrão). Usado SÓ pelo stub; a IA usará seu próprio
// conhecimento. Os ids batem com os do quiz (step 1) quando aplicável.
// =============================================================================

export type FoodRole = 'protein' | 'carb' | 'veg' | 'fruit' | 'fat' | 'dairy'

// Refeições onde um alimento é culturalmente adequado.
// Evita absurdos como "arroz cocido no café da manhã".
export type MealSlot = 'desayuno' | 'almuerzo' | 'cena' | 'snack'

// Medida caseira: quantos gramas equivalem a 1 unidade caseira (taza, pieza…).
// Permite mostrar a porção sem balança ("≈1½ tazas") além das gramas.
export interface HomeMeasure {
  unit: string // singular, ex.: 'taza', 'pieza', 'porción'
  grams: number // gramas em 1 unidade
  plural?: string // só quando o plural não é unit+'s' (ex.: porción→porciones)
}

export interface CatalogFood {
  id: string
  label: string // nome em espanhol
  role: FoodRole
  meals: MealSlot[] // refeições onde faz sentido servir este alimento
  // macros por 100 g
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  home: HomeMeasure // medida caseira de referência
}

// Atalhos de combinações comuns de refeições
const PRINCIPALES: MealSlot[] = ['almuerzo', 'cena'] // proteína/carbo de prato principal
const MANANA_SNACK: MealSlot[] = ['desayuno', 'snack']

// Medidas caseiras reutilizadas
const PORCION = { unit: 'porción', grams: 120, plural: 'porciones' }
const PORCION_SM = { unit: 'porción', grams: 100, plural: 'porciones' }

export const FOOD_CATALOG: CatalogFood[] = [
  // Proteínas
  { id: 'pollo', label: 'Pechuga de pollo', role: 'protein', meals: PRINCIPALES, kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, home: PORCION },
  { id: 'carne_res', label: 'Carne de res magra', role: 'protein', meals: PRINCIPALES, kcal: 217, proteinG: 26, carbsG: 0, fatG: 12, home: PORCION },
  { id: 'cerdo', label: 'Lomo de cerdo', role: 'protein', meals: PRINCIPALES, kcal: 242, proteinG: 27, carbsG: 0, fatG: 14, home: PORCION },
  { id: 'pescado', label: 'Filete de pescado', role: 'protein', meals: PRINCIPALES, kcal: 128, proteinG: 26, carbsG: 0, fatG: 2.5, home: { unit: 'filete', grams: 120 } },
  { id: 'mariscos', label: 'Camarones', role: 'protein', meals: PRINCIPALES, kcal: 99, proteinG: 24, carbsG: 0.2, fatG: 0.3, home: PORCION_SM },
  { id: 'huevo', label: 'Huevo', role: 'protein', meals: ['desayuno', 'almuerzo', 'cena'], kcal: 143, proteinG: 13, carbsG: 1.1, fatG: 9.5, home: { unit: 'huevo', grams: 50 } },
  { id: 'tofu', label: 'Tofu firme', role: 'protein', meals: PRINCIPALES, kcal: 144, proteinG: 17, carbsG: 2.8, fatG: 9, home: PORCION_SM },
  { id: 'legumbres', label: 'Lentejas / frijoles', role: 'protein', meals: PRINCIPALES, kcal: 116, proteinG: 9, carbsG: 20, fatG: 0.4, home: { unit: 'taza', grams: 180 } },
  { id: 'atun', label: 'Atún (en agua)', role: 'protein', meals: PRINCIPALES, kcal: 116, proteinG: 26, carbsG: 0, fatG: 1, home: { unit: 'lata', grams: 120 } },
  { id: 'pavo', label: 'Pechuga de pavo', role: 'protein', meals: ['desayuno', 'almuerzo', 'cena'], kcal: 135, proteinG: 29, carbsG: 0, fatG: 1.7, home: PORCION },
  // Carboidratos
  { id: 'arroz', label: 'Arroz cocido', role: 'carb', meals: PRINCIPALES, kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, home: { unit: 'taza', grams: 160 } },
  { id: 'pasta', label: 'Pasta cocida', role: 'carb', meals: PRINCIPALES, kcal: 158, proteinG: 5.8, carbsG: 31, fatG: 0.9, home: { unit: 'taza', grams: 140 } },
  { id: 'pan', label: 'Pan integral', role: 'carb', meals: MANANA_SNACK, kcal: 265, proteinG: 9, carbsG: 49, fatG: 3.2, home: { unit: 'rebanada', grams: 30 } },
  { id: 'avena', label: 'Avena', role: 'carb', meals: MANANA_SNACK, kcal: 389, proteinG: 17, carbsG: 66, fatG: 7, home: PORCION_SM },
  { id: 'papa', label: 'Papa cocida', role: 'carb', meals: PRINCIPALES, kcal: 87, proteinG: 1.9, carbsG: 20, fatG: 0.1, home: { unit: 'pieza', grams: 150 } },
  { id: 'quinoa', label: 'Quinoa cocida', role: 'carb', meals: PRINCIPALES, kcal: 120, proteinG: 4.4, carbsG: 21, fatG: 1.9, home: { unit: 'taza', grams: 185 } },
  { id: 'camote', label: 'Camote / batata', role: 'carb', meals: PRINCIPALES, kcal: 90, proteinG: 2, carbsG: 21, fatG: 0.1, home: { unit: 'pieza', grams: 130 } },
  { id: 'granola', label: 'Granola', role: 'carb', meals: MANANA_SNACK, kcal: 471, proteinG: 10, carbsG: 64, fatG: 20, home: PORCION_SM },
  // Regionais (México) — tortilla e nopales se comem también en el desayuno
  { id: 'tortilla_maiz', label: 'Tortilla de maíz', role: 'carb', meals: ['desayuno', 'almuerzo', 'cena'], kcal: 218, proteinG: 5.7, carbsG: 44, fatG: 2.5, home: { unit: 'tortilla', grams: 25 } },
  // Regionais (Colombia) — la arepa es desayuno típico
  { id: 'arepa', label: 'Arepa de maíz', role: 'carb', meals: ['desayuno', 'almuerzo', 'cena'], kcal: 217, proteinG: 4.5, carbsG: 44, fatG: 2.4, home: { unit: 'arepa', grams: 120 } },
  { id: 'platano', label: 'Plátano maduro cocido', role: 'carb', meals: PRINCIPALES, kcal: 122, proteinG: 1.3, carbsG: 32, fatG: 0.4, home: { unit: 'pieza', grams: 120 } },
  { id: 'yuca', label: 'Yuca cocida', role: 'carb', meals: PRINCIPALES, kcal: 160, proteinG: 1.4, carbsG: 38, fatG: 0.3, home: PORCION },
  // Vegetais / frutas / gorduras
  { id: 'verduras', label: 'Verduras mixtas', role: 'veg', meals: PRINCIPALES, kcal: 35, proteinG: 2, carbsG: 7, fatG: 0.3, home: { unit: 'taza', grams: 90 } },
  { id: 'tomate', label: 'Tomate / ensalada', role: 'veg', meals: PRINCIPALES, kcal: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2, home: { unit: 'pieza', grams: 120 } },
  { id: 'espinaca', label: 'Espinaca', role: 'veg', meals: ['desayuno', 'almuerzo', 'cena'], kcal: 23, proteinG: 2.9, carbsG: 3.6, fatG: 0.4, home: { unit: 'taza', grams: 90 } },
  { id: 'nopales', label: 'Nopales', role: 'veg', meals: ['desayuno', 'almuerzo', 'cena'], kcal: 16, proteinG: 1.4, carbsG: 3.3, fatG: 0.1, home: { unit: 'taza', grams: 80 } },
  { id: 'brocoli', label: 'Brócoli', role: 'veg', meals: PRINCIPALES, kcal: 34, proteinG: 2.8, carbsG: 7, fatG: 0.4, home: { unit: 'taza', grams: 90 } },
  { id: 'zanahoria', label: 'Zanahoria', role: 'veg', meals: PRINCIPALES, kcal: 41, proteinG: 0.9, carbsG: 10, fatG: 0.2, home: { unit: 'taza', grams: 90 } },
  { id: 'calabacin', label: 'Calabacín', role: 'veg', meals: PRINCIPALES, kcal: 17, proteinG: 1.2, carbsG: 3.1, fatG: 0.3, home: { unit: 'taza', grams: 90 } },
  { id: 'ejotes', label: 'Ejotes / judías verdes', role: 'veg', meals: PRINCIPALES, kcal: 31, proteinG: 1.8, carbsG: 7, fatG: 0.2, home: { unit: 'taza', grams: 90 } },
  { id: 'champinones', label: 'Champiñones', role: 'veg', meals: ['desayuno', 'almuerzo', 'cena'], kcal: 22, proteinG: 3.1, carbsG: 3.3, fatG: 0.3, home: { unit: 'taza', grams: 90 } },
  { id: 'pimiento', label: 'Pimiento', role: 'veg', meals: ['desayuno', 'almuerzo', 'cena'], kcal: 31, proteinG: 1, carbsG: 6, fatG: 0.3, home: { unit: 'taza', grams: 90 } },
  { id: 'coliflor', label: 'Coliflor', role: 'veg', meals: PRINCIPALES, kcal: 25, proteinG: 1.9, carbsG: 5, fatG: 0.3, home: { unit: 'taza', grams: 90 } },
  { id: 'pepino', label: 'Pepino', role: 'veg', meals: PRINCIPALES, kcal: 15, proteinG: 0.7, carbsG: 3.6, fatG: 0.1, home: { unit: 'taza', grams: 100 } },
  { id: 'frutas', label: 'Fruta de temporada', role: 'fruit', meals: MANANA_SNACK, kcal: 60, proteinG: 0.8, carbsG: 15, fatG: 0.2, home: { unit: 'pieza', grams: 120 } },
  { id: 'manzana', label: 'Manzana', role: 'fruit', meals: MANANA_SNACK, kcal: 52, proteinG: 0.3, carbsG: 14, fatG: 0.2, home: { unit: 'pieza', grams: 150 } },
  { id: 'banana', label: 'Plátano / banana', role: 'fruit', meals: MANANA_SNACK, kcal: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3, home: { unit: 'pieza', grams: 120 } },
  { id: 'fresa', label: 'Fresas', role: 'fruit', meals: MANANA_SNACK, kcal: 32, proteinG: 0.7, carbsG: 8, fatG: 0.3, home: { unit: 'taza', grams: 150 } },
  { id: 'papaya', label: 'Papaya', role: 'fruit', meals: MANANA_SNACK, kcal: 43, proteinG: 0.5, carbsG: 11, fatG: 0.3, home: { unit: 'taza', grams: 140 } },
  { id: 'pina', label: 'Piña', role: 'fruit', meals: MANANA_SNACK, kcal: 50, proteinG: 0.5, carbsG: 13, fatG: 0.1, home: { unit: 'taza', grams: 150 } },
  { id: 'mango', label: 'Mango', role: 'fruit', meals: MANANA_SNACK, kcal: 60, proteinG: 0.8, carbsG: 15, fatG: 0.4, home: { unit: 'pieza', grams: 120 } },
  { id: 'naranja', label: 'Naranja', role: 'fruit', meals: MANANA_SNACK, kcal: 47, proteinG: 0.9, carbsG: 12, fatG: 0.1, home: { unit: 'pieza', grams: 130 } },
  { id: 'aguacate', label: 'Aguacate', role: 'fat', meals: ['desayuno', 'almuerzo', 'cena', 'snack'], kcal: 160, proteinG: 2, carbsG: 9, fatG: 15, home: { unit: 'pieza', grams: 150 } },
  { id: 'nueces', label: 'Nueces / frutos secos', role: 'fat', meals: MANANA_SNACK, kcal: 607, proteinG: 15, carbsG: 14, fatG: 54, home: { unit: 'puñado', grams: 30 } },
  { id: 'lacteos', label: 'Yogur natural / leche', role: 'dairy', meals: MANANA_SNACK, kcal: 61, proteinG: 3.5, carbsG: 4.7, fatG: 3.3, home: { unit: 'taza', grams: 240 } },
  { id: 'queso_fresco', label: 'Queso fresco / panela', role: 'dairy', meals: ['desayuno', 'almuerzo', 'cena', 'snack'], kcal: 215, proteinG: 18, carbsG: 4, fatG: 14, home: PORCION_SM },
  { id: 'yogur_griego', label: 'Yogur griego', role: 'dairy', meals: MANANA_SNACK, kcal: 59, proteinG: 10, carbsG: 3.6, fatG: 0.4, home: { unit: 'envase', grams: 150 } },
  { id: 'aceite', label: 'Aceite de oliva', role: 'fat', meals: PRINCIPALES, kcal: 884, proteinG: 0, carbsG: 0, fatG: 100, home: { unit: 'cucharada', grams: 14 } },
]

export const CATALOG_BY_ID: Record<string, CatalogFood> = Object.fromEntries(
  FOOD_CATALOG.map((f) => [f.id, f]),
)

export const CATALOG_BY_LABEL: Record<string, CatalogFood> = Object.fromEntries(
  FOOD_CATALOG.map((f) => [f.label, f]),
)

export function foodsByRole(role: FoodRole): CatalogFood[] {
  return FOOD_CATALOG.filter((f) => f.role === role)
}

/** Alimentos de um papel adequados para uma refeição específica. */
export function foodsForMeal(meal: MealSlot, role: FoodRole): CatalogFood[] {
  return FOOD_CATALOG.filter((f) => f.role === role && f.meals.includes(meal))
}

/** Formata uma quantidade em gramas como medida caseira: "≈1½ tazas". */
export function formatHomeMeasure(grams: number, home: HomeMeasure): string {
  const count = grams / home.grams
  const rounded = Math.max(0.5, Math.round(count * 2) / 2)
  const whole = Math.floor(rounded)
  const hasHalf = rounded - whole === 0.5
  const num = whole === 0 ? '½' : `${whole}${hasHalf ? '½' : ''}`
  const unit = rounded > 1 ? home.plural ?? `${home.unit}s` : home.unit
  return `≈${num} ${unit}`
}
