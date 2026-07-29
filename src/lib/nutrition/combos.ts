// =============================================================================
// NutriPlan — Método CALIBRA: los 7 combos de la Calibración Metabólica
//
// CALIBRA es el acrónimo de las 7 combinaciones, en el orden en que se
// entregan (n=1..7 deletrea la palabra): Candado, Arranque, Lleno, Inverso,
// Blindaje, Resistente, Anticipo. No es casualidad que suene a "Calibración":
// es la parte tangible y ejecutable del mecanismo — lo que ella hace, no solo
// lo que el plan calcula.
//
// Cada combo es una REGLA DE 10 SEGUNDOS aplicada sobre el plan que el
// generador ya arma, nunca una receta nueva: el villano del avatar es
// escasez de tiempo (ver .agents/product-marketing.md), así que ningún combo
// puede costar tiempo de cocina.
//
// Todos los efectos aquí son reales y defendibles. El envoltorio es apelativo,
// el contenido no está inventado — es lo que mantiene el reembolso en cero. Al
// editar el texto de un combo, el campo `science` es el límite: no prometas
// nada que él no sostenga.
// =============================================================================

/** Momento do dia em que o combo se aplica (usado pra ordenar na UI). */
export type ComboMoment = 'mañana' | 'antes de comer' | 'en la mesa' | 'noche' | 'todo el día'

export interface Combo {
  id: string
  /** Número fixo 1-7. También indexa la letra de CALIBRA (letter[n-1]). */
  n: number
  /** La letra que este combo aporta al acrónimo CALIBRA. */
  letter: string
  /** Nome curto, o que ela repete pra amiga. */
  name: string
  /** O que ela SENTE. Benefício, nunca mecanismo. */
  tagline: string
  moment: ComboMoment
  /** A instrução literal. Tem que caber em 10 segundos de execução.
   *  REGRA DURA: nunca citar um número (gramas, porções) que o plano gerado
   *  não entregue de fato — a instrução tem que bater com o cardápio do dia,
   *  senão o mecanismo se contradiz na cara dela. Quando o número varia por
   *  pessoa, mande ela olhar o plano ("tu plan ya te marca cuánta"). */
  action: string
  /** O "segredo": traduz o mecanismo em causa → efeito que ela SENTE, com
   *  imagem concreta. É o que faz parecer descoberta em vez de dica genérica.
   *  Continua limitado por `science`: embalagem apelativa, conteúdo real. */
  secret: string
  /** Por que funciona, na linguagem dela (não é o paper, é a tradução). */
  why: string
  /** Base fisiológica real. Auditoria interna: se um claim não couber aqui, sai. */
  science: string
  /** Ingredientes extra que este combo exige na lista de compras. */
  ingredientIds?: string[]
  emoji: string
}

/** La palabra que deletrean los 7 combos, en orden. */
export const METHOD_NAME = 'CALIBRA'

export const COMBOS: Combo[] = [
  {
    id: 'candado',
    n: 1,
    letter: 'C',
    name: 'Candado',
    tagline: 'Cierras la cocina y no vuelves a abrirla',
    moment: 'noche',
    action:
      'La última comida del día lleva proteína más una grasa buena (aguacate, aceite de oliva, un puñado de nueces) y cero azúcar simple. Después de eso, la cocina está cerrada.',
    secret:
      'Cuando juntas proteína con una grasa buena en la última comida y cortas el azúcar simple, tu cuerpo activa su mecanismo de protección de la saciedad: en vez de vaciarse rápido y despertarte con hambre, sostiene toda la noche. Por eso no picas nada a las 11 y tampoco amaneces exagerando en el desayuno.',
    why: 'La noche es donde la mayoría de las dietas se cae. Una cena que sostiene de verdad quita el impulso de volver a la alacena a las 11.',
    science:
      'Proteína y grasa en la última comida prolongan la saciedad nocturna; evitar azúcares simples en ese momento reduce el rebote de hambre por caída glucémica.',
    emoji: '🔒',
  },
  {
    id: 'arranque',
    n: 2,
    letter: 'A',
    name: 'Arranque',
    tagline: 'Llegas al almuerzo sin desesperación',
    moment: 'mañana',
    action:
      'Empieza el desayuno por la proteína, siempre antes del carbohidrato. Tu plan ya te marca cuál es y cuánta te toca hoy.',
    secret:
      'Tu cuerpo gasta hasta 6 veces más energía digiriendo proteína que digiriendo carbohidrato. Al entrar el día por ahí, arrancas quemando desde la primera mordida y ese ritmo te acompaña el resto del día. Es el mismo desayuno, en otro orden.',
    why: 'Empezar el día con proteína apaga el hambre de la tarde antes de que aparezca. Además, tu cuerpo gasta parte de esas calorías solo en digerirla.',
    science:
      'Efecto térmico de los alimentos: 20-30% de las calorías de la proteína se gastan en digestión y metabolismo, contra 5-10% de los carbohidratos y 0-3% de las grasas. Desayuno alto en proteína se asocia a menor ingesta espontánea el resto del día.',
    emoji: '⚡',
  },
  {
    id: 'lleno',
    n: 3,
    letter: 'L',
    name: 'Lleno',
    tagline: 'Cierra el hambre por horas, sin comer de más',
    moment: 'mañana',
    action:
      '1 cucharada de la mezcla (chía + linaza + psyllium a partes iguales) en un vaso de agua, tomada junto a tu fuente de proteína del desayuno. Se toma de inmediato, antes de que espese.',
    secret:
      'Esas tres fibras juntas forman un gel que funciona como un radar de tránsito dentro de tu estómago: obligan a la comida a bajar la velocidad. En vez de vaciarse en una hora, tu estómago se queda lleno durante horas. No es que aguantes el hambre, es que no llega.',
    why: 'La mezcla forma un gel en el estómago. Ese gel, junto a la proteína, hace que la comida salga más lento del estómago. Por eso llegas a la tarde sin esa ansiedad de picar cualquier cosa.',
    science:
      'Fibra viscosa (psyllium, chía, linaza) retarda el vaciamiento gástrico y aumenta la saciedad; el efecto es mayor cuando se combina con proteína en la misma comida.',
    ingredientIds: ['chia', 'linaza', 'psyllium'],
    emoji: '🥣',
  },
  {
    id: 'inverso',
    n: 4,
    letter: 'I',
    name: 'Inverso',
    tagline: 'Se acaba el bajón de las 3 de la tarde',
    moment: 'en la mesa',
    action:
      'Come en este orden dentro del mismo plato: primero la verdura, después la proteína, y el carbohidrato al final. Mismo plato, misma cantidad, otro orden.',
    secret:
      'La verdura y la proteína arman un colchón en tu estómago antes de que llegue el carbohidrato. El azúcar entra frenada, sin el pico de golpe. Y sin pico no hay caída: se acaba ese bajón de las 3 de la tarde que te deja con sueño y buscando algo dulce.',
    why: 'El mismo almuerzo te cae distinto según el orden en que lo comes. Terminar por el carbohidrato evita el subidón y el bajón que te deja con sueño y con hambre otra vez.',
    science:
      'Consumir verduras y proteína antes del carbohidrato reduce de forma medible el pico de glucosa e insulina postprandial frente a la secuencia inversa.',
    emoji: '🔄',
  },
  {
    id: 'blindaje',
    n: 5,
    letter: 'B',
    name: 'Blindaje',
    tagline: 'Pierdes grasa, no el músculo que sostiene tu metabolismo',
    moment: 'todo el día',
    action:
      'Come la proteína de las 3 comidas, sin saltarte ninguna. Nunca todo el día ligero y la carga entera en la cena. Tu plan ya la reparte por ti.',
    secret:
      'Tu músculo es el motor que quema calorías incluso cuando estás sentada. La mayoría de las dietas lo apaga: bajas rápido, el motor se achica, y el peso vuelve. Repartir la proteína en las 3 comidas blinda ese motor, así lo que baja es la grasa y no tu capacidad de quemarla.',
    why: 'Si bajas de peso perdiendo músculo, tu cuerpo pasa a gastar menos y el peso vuelve. Repartir la proteína es lo que protege ese músculo mientras la grasa baja.',
    science:
      'En déficit calórico, ingesta proteica adecuada y distribuida a lo largo del día preserva masa magra, lo que sostiene el gasto energético total.',
    emoji: '🛡️',
  },
  {
    id: 'resistente',
    n: 6,
    letter: 'R',
    name: 'Resistente',
    tagline: 'Comes arroz y pasta sin sentirte hinchada',
    moment: 'en la mesa',
    action:
      'Cocina el arroz, la papa o la pasta y déjalos en la nevera mínimo 12 horas antes de comerlos. Puedes recalentarlos, el efecto se mantiene.',
    secret:
      'El frío reorganiza el almidón por dentro. Una parte se vuelve tan compacta que tu cuerpo ya no la puede romper en azúcar: pasa de largo y termina alimentando tu flora intestinal, como si fuera fibra. Mismo arroz, misma cantidad, y una parte deja de contar como azúcar rápido.',
    why: 'Enfriar el almidón cambia su estructura. Una parte deja de comportarse como azúcar rápido y pasa de largo hacia el intestino, donde alimenta tu flora.',
    science:
      'La retrogradación del almidón durante el enfriamiento genera almidón resistente, que reduce la respuesta glucémica y actúa como fibra fermentable.',
    emoji: '❄️',
  },
  {
    id: 'anticipo',
    n: 7,
    letter: 'A',
    name: 'Anticipo',
    tagline: 'Comes menos sin estar controlándote',
    moment: 'antes de comer',
    action:
      '20 minutos antes del almuerzo o de la cena: un vaso grande de agua más una porción pequeña de proteína (un huevo, una cucharada de yogur griego, unas lonchas de pavo).',
    secret:
      'Tu estómago tarda unos 20 minutos en avisarle a tu cerebro que ya hay comida. El truco es mandar ese aviso antes de sentarte: llegas a la mesa con el hambre ya bajando, te sirves menos y paras antes, sin estar frenándote con fuerza de voluntad.',
    why: 'Llegas a la mesa con el hambre ya bajada. No tienes que frenarte con fuerza de voluntad, simplemente no te cabe tanto.',
    science:
      'Precarga de proteína y volumen antes de la comida principal reduce la ingesta calórica espontánea en esa comida.',
    emoji: '⏱️',
  },
]

export const COMBOS_BY_ID: Record<string, Combo> = Object.fromEntries(
  COMBOS.map((c) => [c.id, c]),
)

/**
 * Combo do dia. O ciclo tem 7 combos (CALIBRA) e o plano tem 7 ou 28 dias,
 * então a rotação fecha certinho: cada dia da semana carrega sempre o mesmo
 * combo, e em 4 semanas ela repete cada um 4 vezes (é o que forma o hábito).
 */
export function comboForDay(dayNum: number): Combo {
  return COMBOS[(dayNum - 1) % COMBOS.length]
}

/** Ids de alimentos que só entram na lista de compras por causa dos combos. */
export const COMBO_INGREDIENT_IDS: string[] = Array.from(
  new Set(COMBOS.flatMap((c) => c.ingredientIds ?? [])),
)
