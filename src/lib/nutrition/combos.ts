// =============================================================================
// NutriPlan — Los 7 Combos de la Calibración Metabólica
//
// O mecanismo único do produto. Cada combo é uma REGRA DE 10 SEGUNDOS aplicada
// sobre o plano que o gerador já monta, nunca uma receita nova: o vilão do
// avatar é escassez de tempo (ver .agents/product-marketing.md), então nenhum
// combo pode custar tempo de cozinha.
//
// Todos os efeitos aqui são reais e defensáveis. A embalagem é apelativa, o
// conteúdo não é inventado — é o que segura o reembolso em zero. Ao editar o
// texto de um combo, o campo `science` é o limite: não prometa nada que ele
// não sustente.
// =============================================================================

/** Momento do dia em que o combo se aplica (usado pra ordenar na UI). */
export type ComboMoment = 'mañana' | 'antes de comer' | 'en la mesa' | 'noche' | 'todo el día'

export interface Combo {
  id: string
  /** Número fixo. É a identidade do combo na UI e nos criativos ("Combo 1"). */
  n: number
  /** Nome curto, o que ela repete pra amiga. */
  name: string
  /** O que ela SENTE. Benefício, nunca mecanismo. */
  tagline: string
  moment: ComboMoment
  /** A instrução literal. Tem que caber em 10 segundos de execução. */
  action: string
  /** Por que funciona, na linguagem dela (não é o paper, é a tradução). */
  why: string
  /** Base fisiológica real. Auditoria interna: se um claim não couber aqui, sai. */
  science: string
  /** Ingredientes extra que este combo exige na lista de compras. */
  ingredientIds?: string[]
  emoji: string
}

export const COMBOS: Combo[] = [
  {
    id: 'sello',
    n: 1,
    name: 'El Sello',
    tagline: 'Cierra el hambre por horas, sin comer de más',
    moment: 'mañana',
    action:
      '1 cucharada de la mezcla (chía + linaza + psyllium a partes iguales) en un vaso de agua, tomada junto a tu fuente de proteína del desayuno. Se toma de inmediato, antes de que espese.',
    why: 'La mezcla forma un gel en el estómago. Ese gel, junto a la proteína, hace que la comida salga más lento del estómago. Por eso llegas a la tarde sin esa ansiedad de picar cualquier cosa.',
    science:
      'Fibra viscosa (psyllium, chía, linaza) retarda el vaciamiento gástrico y aumenta la saciedad; el efecto es mayor cuando se combina con proteína en la misma comida.',
    ingredientIds: ['chia', 'linaza', 'psyllium'],
    emoji: '🔒',
  },
  {
    id: 'arranque30',
    n: 2,
    name: 'Arranque 30',
    tagline: 'Llegas al almuerzo sin desesperación',
    moment: 'mañana',
    action:
      'Mínimo 30 g de proteína en la primera comida del día, y siempre antes del carbohidrato. Tu plan ya te marca cuál y cuánta.',
    why: 'Empezar el día con proteína apaga el hambre de la tarde antes de que aparezca. Además, tu cuerpo gasta parte de esas calorías solo en digerirla.',
    science:
      'Efecto térmico de los alimentos: 20-30% de las calorías de la proteína se gastan en digestión y metabolismo, contra 5-10% de los carbohidratos y 0-3% de las grasas. Desayuno alto en proteína se asocia a menor ingesta espontánea el resto del día.',
    emoji: '⚡',
  },
  {
    id: 'plato_al_reves',
    n: 3,
    name: 'Plato al Revés',
    tagline: 'Se acaba el bajón de las 3 de la tarde',
    moment: 'en la mesa',
    action:
      'Come en este orden dentro del mismo plato: primero la verdura, después la proteína, y el carbohidrato al final. Mismo plato, misma cantidad, otro orden.',
    why: 'El mismo almuerzo te cae distinto según el orden en que lo comes. Terminar por el carbohidrato evita el subidón y el bajón que te deja con sueño y con hambre otra vez.',
    science:
      'Consumir verduras y proteína antes del carbohidrato reduce de forma medible el pico de glucosa e insulina postprandial frente a la secuencia inversa.',
    emoji: '🔄',
  },
  {
    id: 'anticipo',
    n: 4,
    name: 'El Anticipo',
    tagline: 'Comes menos sin estar controlándote',
    moment: 'antes de comer',
    action:
      '20 minutos antes del almuerzo o de la cena: un vaso grande de agua más una porción pequeña de proteína (un huevo, una cucharada de yogur griego, unas lonchas de pavo).',
    why: 'Llegas a la mesa con el hambre ya bajada. No tienes que frenarte con fuerza de voluntad, simplemente no te cabe tanto.',
    science:
      'Precarga de proteína y volumen antes de la comida principal reduce la ingesta calórica espontánea en esa comida.',
    emoji: '⏱️',
  },
  {
    id: 'carbo_frio',
    n: 5,
    name: 'Carbo Frío',
    tagline: 'Comes arroz y pasta sin sentirte hinchada',
    moment: 'en la mesa',
    action:
      'Cocina el arroz, la papa o la pasta y déjalos en la nevera mínimo 12 horas antes de comerlos. Puedes recalentarlos, el efecto se mantiene.',
    why: 'Enfriar el almidón cambia su estructura. Una parte deja de comportarse como azúcar rápido y pasa de largo hacia el intestino, donde alimenta tu flora.',
    science:
      'La retrogradación del almidón durante el enfriamiento genera almidón resistente, que reduce la respuesta glucémica y actúa como fibra fermentable.',
    emoji: '❄️',
  },
  {
    id: 'reparto',
    n: 6,
    name: 'El Reparto',
    tagline: 'Pierdes grasa, no el músculo que sostiene tu metabolismo',
    moment: 'todo el día',
    action:
      'Proteína repartida en las 3 comidas, 25 a 30 g en cada una. Nunca todo el día ligero y la carga entera en la cena.',
    why: 'Si bajas de peso perdiendo músculo, tu cuerpo pasa a gastar menos y el peso vuelve. Repartir la proteína es lo que protege ese músculo mientras la grasa baja.',
    science:
      'En déficit calórico, ingesta proteica adecuada y distribuida a lo largo del día preserva masa magra, lo que sostiene el gasto energético total.',
    emoji: '🧱',
  },
  {
    id: 'candado',
    n: 7,
    name: 'El Candado',
    tagline: 'Cierras la cocina y no vuelves a abrirla',
    moment: 'noche',
    action:
      'La última comida del día lleva proteína más una grasa buena (aguacate, aceite de oliva, un puñado de nueces) y cero azúcar simple. Después de eso, la cocina está cerrada.',
    why: 'La noche es donde la mayoría de las dietas se cae. Una cena que sostiene de verdad quita el impulso de volver a la alacena a las 11.',
    science:
      'Proteína y grasa en la última comida prolongan la saciedad nocturna; evitar azúcares simples en ese momento reduce el rebote de hambre por caída glucémica.',
    emoji: '🌙',
  },
]

export const COMBOS_BY_ID: Record<string, Combo> = Object.fromEntries(
  COMBOS.map((c) => [c.id, c]),
)

/**
 * Combo do dia. O ciclo tem 7 combos e o plano tem 7 ou 28 dias, então a
 * rotação fecha certinho: cada dia da semana carrega sempre o mesmo combo,
 * e em 4 semanas ela repete cada um 4 vezes (é o que forma o hábito).
 */
export function comboForDay(dayNum: number): Combo {
  return COMBOS[(dayNum - 1) % COMBOS.length]
}

/** Ids de alimentos que só entram na lista de compras por causa dos combos. */
export const COMBO_INGREDIENT_IDS: string[] = Array.from(
  new Set(COMBOS.flatMap((c) => c.ingredientIds ?? [])),
)
