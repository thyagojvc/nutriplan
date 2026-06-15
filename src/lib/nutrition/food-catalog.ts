// =============================================================================
// NutriPlan — Catálogo de alimentos (Fase C)
// Base de dados mínima para o gerador stub compor refeições coerentes.
// Macros por 100 g (cru/padrão). Usado SÓ pelo stub; a IA usará seu próprio
// conhecimento. Os ids batem com os do quiz (step 1) quando aplicável.
// =============================================================================

export type FoodRole = 'protein' | 'carb' | 'veg' | 'fruit' | 'fat' | 'dairy'

export interface CatalogFood {
  id: string
  label: string // nome em espanhol
  role: FoodRole
  // macros por 100 g
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  unit: string // medida caseira de referência (ex.: "1 pechuga (~120 g)")
}

export const FOOD_CATALOG: CatalogFood[] = [
  // Proteínas
  { id: 'pollo', label: 'Pechuga de pollo', role: 'protein', kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, unit: 'g a la plancha' },
  { id: 'carne_res', label: 'Carne de res magra', role: 'protein', kcal: 217, proteinG: 26, carbsG: 0, fatG: 12, unit: 'g' },
  { id: 'cerdo', label: 'Lomo de cerdo', role: 'protein', kcal: 242, proteinG: 27, carbsG: 0, fatG: 14, unit: 'g' },
  { id: 'pescado', label: 'Filete de pescado', role: 'protein', kcal: 128, proteinG: 26, carbsG: 0, fatG: 2.5, unit: 'g al horno' },
  { id: 'mariscos', label: 'Camarones', role: 'protein', kcal: 99, proteinG: 24, carbsG: 0.2, fatG: 0.3, unit: 'g' },
  { id: 'huevo', label: 'Huevo', role: 'protein', kcal: 143, proteinG: 13, carbsG: 1.1, fatG: 9.5, unit: 'g (≈1 huevo por c/50 g)' },
  { id: 'tofu', label: 'Tofu firme', role: 'protein', kcal: 144, proteinG: 17, carbsG: 2.8, fatG: 9, unit: 'g' },
  { id: 'legumbres', label: 'Lentejas / frijoles', role: 'protein', kcal: 116, proteinG: 9, carbsG: 20, fatG: 0.4, unit: 'g cocidos' },
  // Carboidratos
  { id: 'arroz', label: 'Arroz cocido', role: 'carb', kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, unit: 'g cocido' },
  { id: 'pasta', label: 'Pasta cocida', role: 'carb', kcal: 158, proteinG: 5.8, carbsG: 31, fatG: 0.9, unit: 'g cocida' },
  { id: 'pan', label: 'Pan / tortillas', role: 'carb', kcal: 265, proteinG: 9, carbsG: 49, fatG: 3.2, unit: 'g' },
  { id: 'avena', label: 'Avena', role: 'carb', kcal: 389, proteinG: 17, carbsG: 66, fatG: 7, unit: 'g en hojuelas' },
  { id: 'papa', label: 'Papa cocida', role: 'carb', kcal: 87, proteinG: 1.9, carbsG: 20, fatG: 0.1, unit: 'g' },
  // Vegetais / frutas / gorduras
  { id: 'verduras', label: 'Verduras mixtas', role: 'veg', kcal: 35, proteinG: 2, carbsG: 7, fatG: 0.3, unit: 'g salteadas' },
  { id: 'frutas', label: 'Fruta de temporada', role: 'fruit', kcal: 60, proteinG: 0.8, carbsG: 15, fatG: 0.2, unit: 'g' },
  { id: 'aguacate', label: 'Aguacate', role: 'fat', kcal: 160, proteinG: 2, carbsG: 9, fatG: 15, unit: 'g (~½ pieza)' },
  { id: 'lacteos', label: 'Yogur natural / leche', role: 'dairy', kcal: 61, proteinG: 3.5, carbsG: 4.7, fatG: 3.3, unit: 'ml' },
  { id: 'aceite', label: 'Aceite de oliva', role: 'fat', kcal: 884, proteinG: 0, carbsG: 0, fatG: 100, unit: 'g (cucharadas)' },
]

export const CATALOG_BY_ID: Record<string, CatalogFood> = Object.fromEntries(
  FOOD_CATALOG.map((f) => [f.id, f]),
)

export function foodsByRole(role: FoodRole): CatalogFood[] {
  return FOOD_CATALOG.filter((f) => f.role === role)
}
