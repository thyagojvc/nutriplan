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
  unit: string // medida caseira de referência (ex.: "1 pechuga (~120 g)")
}

// Atalhos de combinações comuns de refeições
const PRINCIPALES: MealSlot[] = ['almuerzo', 'cena'] // proteína/carbo de prato principal
const MANANA_SNACK: MealSlot[] = ['desayuno', 'snack']

export const FOOD_CATALOG: CatalogFood[] = [
  // Proteínas
  { id: 'pollo', label: 'Pechuga de pollo', role: 'protein', meals: PRINCIPALES, kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, unit: 'g a la plancha' },
  { id: 'carne_res', label: 'Carne de res magra', role: 'protein', meals: PRINCIPALES, kcal: 217, proteinG: 26, carbsG: 0, fatG: 12, unit: 'g' },
  { id: 'cerdo', label: 'Lomo de cerdo', role: 'protein', meals: PRINCIPALES, kcal: 242, proteinG: 27, carbsG: 0, fatG: 14, unit: 'g' },
  { id: 'pescado', label: 'Filete de pescado', role: 'protein', meals: PRINCIPALES, kcal: 128, proteinG: 26, carbsG: 0, fatG: 2.5, unit: 'g al horno' },
  { id: 'mariscos', label: 'Camarones', role: 'protein', meals: PRINCIPALES, kcal: 99, proteinG: 24, carbsG: 0.2, fatG: 0.3, unit: 'g' },
  { id: 'huevo', label: 'Huevo', role: 'protein', meals: ['desayuno', 'almuerzo', 'cena'], kcal: 143, proteinG: 13, carbsG: 1.1, fatG: 9.5, unit: 'g (≈1 huevo por c/50 g)' },
  { id: 'tofu', label: 'Tofu firme', role: 'protein', meals: PRINCIPALES, kcal: 144, proteinG: 17, carbsG: 2.8, fatG: 9, unit: 'g' },
  { id: 'legumbres', label: 'Lentejas / frijoles', role: 'protein', meals: PRINCIPALES, kcal: 116, proteinG: 9, carbsG: 20, fatG: 0.4, unit: 'g cocidos' },
  { id: 'atun', label: 'Atún (en agua)', role: 'protein', meals: PRINCIPALES, kcal: 116, proteinG: 26, carbsG: 0, fatG: 1, unit: 'g (≈1 lata escurrida)' },
  { id: 'pavo', label: 'Pechuga de pavo', role: 'protein', meals: ['desayuno', 'almuerzo', 'cena'], kcal: 135, proteinG: 29, carbsG: 0, fatG: 1.7, unit: 'g a la plancha' },
  // Carboidratos
  { id: 'arroz', label: 'Arroz cocido', role: 'carb', meals: PRINCIPALES, kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, unit: 'g cocido' },
  { id: 'pasta', label: 'Pasta cocida', role: 'carb', meals: PRINCIPALES, kcal: 158, proteinG: 5.8, carbsG: 31, fatG: 0.9, unit: 'g cocida' },
  { id: 'pan', label: 'Pan integral', role: 'carb', meals: MANANA_SNACK, kcal: 265, proteinG: 9, carbsG: 49, fatG: 3.2, unit: 'g' },
  { id: 'avena', label: 'Avena', role: 'carb', meals: MANANA_SNACK, kcal: 389, proteinG: 17, carbsG: 66, fatG: 7, unit: 'g en hojuelas' },
  { id: 'papa', label: 'Papa cocida', role: 'carb', meals: PRINCIPALES, kcal: 87, proteinG: 1.9, carbsG: 20, fatG: 0.1, unit: 'g' },
  { id: 'quinoa', label: 'Quinoa cocida', role: 'carb', meals: PRINCIPALES, kcal: 120, proteinG: 4.4, carbsG: 21, fatG: 1.9, unit: 'g cocida' },
  { id: 'camote', label: 'Camote / batata', role: 'carb', meals: PRINCIPALES, kcal: 90, proteinG: 2, carbsG: 21, fatG: 0.1, unit: 'g cocido' },
  { id: 'granola', label: 'Granola', role: 'carb', meals: MANANA_SNACK, kcal: 471, proteinG: 10, carbsG: 64, fatG: 20, unit: 'g' },
  // Regionais (México) — tortilla e nopales se comem también en el desayuno
  { id: 'tortilla_maiz', label: 'Tortilla de maíz', role: 'carb', meals: ['desayuno', 'almuerzo', 'cena'], kcal: 218, proteinG: 5.7, carbsG: 44, fatG: 2.5, unit: 'g (≈2 tortillas medianas)' },
  // Regionais (Colombia) — la arepa es desayuno típico
  { id: 'arepa', label: 'Arepa de maíz', role: 'carb', meals: ['desayuno', 'almuerzo', 'cena'], kcal: 217, proteinG: 4.5, carbsG: 44, fatG: 2.4, unit: 'g (≈1 arepa mediana)' },
  { id: 'platano', label: 'Plátano maduro cocido', role: 'carb', meals: PRINCIPALES, kcal: 122, proteinG: 1.3, carbsG: 32, fatG: 0.4, unit: 'g' },
  { id: 'yuca', label: 'Yuca cocida', role: 'carb', meals: PRINCIPALES, kcal: 160, proteinG: 1.4, carbsG: 38, fatG: 0.3, unit: 'g' },
  // Vegetais / frutas / gorduras
  { id: 'verduras', label: 'Verduras mixtas', role: 'veg', meals: PRINCIPALES, kcal: 35, proteinG: 2, carbsG: 7, fatG: 0.3, unit: 'g salteadas' },
  { id: 'tomate', label: 'Tomate / ensalada', role: 'veg', meals: PRINCIPALES, kcal: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2, unit: 'g' },
  { id: 'espinaca', label: 'Espinaca', role: 'veg', meals: ['desayuno', 'almuerzo', 'cena'], kcal: 23, proteinG: 2.9, carbsG: 3.6, fatG: 0.4, unit: 'g' },
  { id: 'nopales', label: 'Nopales', role: 'veg', meals: ['desayuno', 'almuerzo', 'cena'], kcal: 16, proteinG: 1.4, carbsG: 3.3, fatG: 0.1, unit: 'g salteados' },
  { id: 'frutas', label: 'Fruta de temporada', role: 'fruit', meals: MANANA_SNACK, kcal: 60, proteinG: 0.8, carbsG: 15, fatG: 0.2, unit: 'g' },
  { id: 'aguacate', label: 'Aguacate', role: 'fat', meals: ['desayuno', 'almuerzo', 'cena', 'snack'], kcal: 160, proteinG: 2, carbsG: 9, fatG: 15, unit: 'g (~½ pieza)' },
  { id: 'nueces', label: 'Nueces / frutos secos', role: 'fat', meals: MANANA_SNACK, kcal: 607, proteinG: 15, carbsG: 14, fatG: 54, unit: 'g (un puñado ≈30 g)' },
  { id: 'lacteos', label: 'Yogur natural / leche', role: 'dairy', meals: MANANA_SNACK, kcal: 61, proteinG: 3.5, carbsG: 4.7, fatG: 3.3, unit: 'ml' },
  { id: 'queso_fresco', label: 'Queso fresco / panela', role: 'dairy', meals: ['desayuno', 'almuerzo', 'cena', 'snack'], kcal: 215, proteinG: 18, carbsG: 4, fatG: 14, unit: 'g' },
  { id: 'yogur_griego', label: 'Yogur griego', role: 'dairy', meals: MANANA_SNACK, kcal: 59, proteinG: 10, carbsG: 3.6, fatG: 0.4, unit: 'g' },
  { id: 'aceite', label: 'Aceite de oliva', role: 'fat', meals: PRINCIPALES, kcal: 884, proteinG: 0, carbsG: 0, fatG: 100, unit: 'g (cucharadas)' },
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
