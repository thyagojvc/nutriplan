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
// Na PÁGINA DE VENDAS os combos se chamam "Protocolos CALIBRA™" e aparecem só
// com nome + `teaser` (efeito, sem explicação). `action`, `secret`, `why` e
// `science` são conteúdo pós-compra: nunca renderizar nítido antes do checkout.
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
  /** O que ela SENTE. Benefício, nunca mecanismo. Usado DENTRO do produto. */
  tagline: string
  /** O texto da PÁGINA DE VENDAS: ideia + efeito numa coisa só, 2 linhas.
   *
   *  REGRA DURA DE ESTILO: nenhum molde. Se dois teasers começarem igual ou
   *  terminarem igual, os dois estão errados. Sete frases com a mesma sintaxe
   *  soam geradas, e é exatamente isso que faz o método parecer uma lista de
   *  dicas em vez de um sistema projetado. Varie a construção de propósito, e
   *  nem todo protocolo precisa do mesmo tamanho.
   *
   *  Conteúdo: entrega o PORQUÊ, nunca o COMO. Nada de ingrediente (exceto
   *  LLENO, ver `revealedIngredient`), quantidade, ordem ou execução. */
  teaser: string
  /** Só o LLENO quebra o padrão: mostra 1 ingrediente de verdade pra provar que
   *  existe conhecimento real por trás, mantendo os outros bloqueados. A reação
   *  buscada é "se um só faz isso, quero saber quais são os outros".
   *
   *  SEM USO NA UI desde 07/08: o Lleno passou a abrir o plano inteiro (ver
   *  DELIVERY_ORDER), então revelar um ingrediente dele dentro de um cadeado
   *  perdeu o sentido. Mantido porque o padrão volta a servir na hora que
   *  outro combo precisar da mesma jogada. */
  revealedIngredient?: { name: string; emoji: string; note: string }
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
  /** Número duro do efeito, quando existe literatura que o sustente.
   *
   *  É o que separa "dica de nutricionista" de "descoberta": uma promessa sem
   *  número ela já ouviu mil vezes e não sente nada; um número ela repete pra
   *  amiga. Por isso o combo que abre o plano é sempre um que TEM proof (ver
   *  DELIVERY_ORDER) — é o primeiro que ela executa e precisa ser o que mais
   *  gera vontade de ver os outros seis.
   *
   *  REGRA: só preencher com número que o `source` sustente de fato, e sempre
   *  renderizar atribuído ("en los estudios..."), nunca como promessa nossa.
   *  Sem fonte, o campo fica vazio e o combo vive só do mecanismo. */
  proof?: { value: string; label: string; source: string }
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
    teaser:
      'El hambre de mañana se decide esta noche. Cuando la cena sostiene de verdad, no picas a las 11 ni amaneces devorando el desayuno.',
    moment: 'noche',
    action:
      'En la cena, prioriza tu fuente de proteína. Y antes de dormir, tu snack ya trae una grasa buena (aguacate, aceite de oliva o un puñado de nueces). Después de eso, la cocina está cerrada.',
    secret:
      'Consumir proteína en la cena y una grasa buena antes de dormir activa el mecanismo de protección de la saciedad de tu cuerpo: en vez de vaciarse rápido y despertarte con hambre, sostiene toda la noche. Por eso no picas nada a las 11 y tampoco amaneces exagerando en el desayuno.',
    why: 'La noche es donde la mayoría de las dietas se cae. Una cena que sostiene de verdad quita el impulso de volver a la alacena a las 11.',
    science:
      'Proteína en la cena y grasa buena antes de dormir prolongan la saciedad nocturna, reduciendo el hambre al despertar y la ingesta espontánea en el desayuno siguiente.',
    emoji: '🔒',
  },
  {
    id: 'arranque',
    n: 2,
    letter: 'A',
    name: 'Arranque',
    tagline: 'Llegas al almuerzo sin desesperación',
    teaser:
      'Digerir no cuesta lo mismo con todos los alimentos: con algunos tu cuerpo gasta hasta seis veces más. Con cuál abres el día cambia cuánto quemas hasta la noche.',
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
    tagline: 'Hasta 43% menos hambre, sin aguantar nada',
    teaser:
      'Tres fibras que por separado no hacen casi nada. Juntas, en el orden y la proporción correctos, forman un gel que frena el vaciado del estómago. En los estudios, hasta 43% menos hambre en las horas siguientes.',
    revealedIngredient: {
      name: 'Chía',
      emoji: '🌱',
      note: 'La chía sola no llega ni cerca de ese número. Es una pieza de una combinación específica.',
    },
    moment: 'mañana',
    action:
      '1 cucharada de la mezcla (chía + linaza + psyllium a partes iguales) en un vaso de agua, tomada junto a tu fuente de proteína del desayuno. Se toma de inmediato, antes de que espese.',
    secret:
      'Por separado, cada una de esas tres fibras hace poco. Juntas cambian de comportamiento: forman un gel que obliga a la comida a bajar despacio, y tu estómago deja de vaciarse en una hora para quedarse lleno durante horas. Ahí está el número que casi nadie conoce: en los estudios, esta combinación reduce el hambre hasta un 43% en las horas siguientes. No es que aguantes mejor. Es que el hambre no llega, y no tuviste que usar ni un gramo de fuerza de voluntad para eso.',
    why: 'No estás peleando contra el hambre, simplemente no aparece. Por eso llegas a la tarde sin esa ansiedad de picar cualquier cosa, y por eso el déficit de tu plan deja de costarte esfuerzo: comes menos porque no te cabe más, no porque te estés frenando.',
    science:
      'Fibra viscosa (psyllium, chía, linaza) retarda el vaciamiento gástrico y aumenta la saciedad; el efecto es mayor cuando se combina con proteína en la misma comida. Revisión de 4 estudios sobre fibra viscosa y apetito: reducciones de apetito subjetivo de hasta ~43% frente a control.',
    // O 43% veio da revisão de 4 estudos feita pelo Thyago (nutricionista
    // responsável) em 07/08/2026. As referências exatas ainda não estão
    // anexadas neste arquivo: se um dia precisar defender o número (Meta,
    // reembolso, dúvida de cliente), pedir a lista pra ele antes de responder.
    // Regra de uso: sempre atribuído ("en los estudios"), nunca como promessa
    // nossa, e nunca no criativo de anúncio (ver compliance em product-marketing).
    proof: {
      value: '43%',
      label: 'menos hambre en las horas siguientes',
      source: 'Revisión de 4 estudios sobre fibra viscosa (psyllium, chía y linaza) y apetito.',
    },
    ingredientIds: ['chia', 'linaza', 'psyllium'],
    emoji: '🥣',
  },
  {
    id: 'inverso',
    n: 4,
    letter: 'I',
    name: 'Inverso',
    tagline: 'Se acaba el bajón de las 3 de la tarde',
    teaser:
      'Mismo plato, misma cantidad, dos resultados distintos. Lo que cambia no está en el plato, y decide si a las 3 de la tarde te tira el bajón.',
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
    // Alternativa avaliada: "El protocolo que protege lo que te hace bajar."
    // Fica mais misteriosa, mas "efecto rebote" é a dor que ela já nomeia
    // sozinha (efeito sanfona), então converte mais que o mistério aqui.
    teaser:
      'Cuando bajas de peso, no todo lo que se va es grasa. Lo que se pierde de más es justo lo que mantiene tu metabolismo arriba, y es la razón por la que el peso siempre vuelve.',
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
    teaser:
      'Un alimento puede cambiar por dentro sin que cambies nada de él. Una parte deja de comportarse como azúcar y empieza a comportarse como fibra.',
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
    teaser:
      'Tu estómago tarda veinte minutos en avisarle a tu cerebro que ya comiste. Te sirves de más dentro de esa ventana. No es ansiedad, es un aviso que llega tarde.',
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
 * Ordem em que os combos são ENTREGUES nos dias do plano.
 *
 * NÃO é a ordem do acrônimo. `COMBOS` segue fixo em C-A-L-I-B-R-A (é o que
 * soletra a palavra e o que o PDF imprime); esta lista é só a rotação por dia.
 *
 * O LLENO abre (07/08/2026, decisão do dono). Motivo: o Día 1 é o único que ela
 * executa ANTES de decidir comprar, então tem que ser o combo mais forte que
 * existe, e o Lleno é o único com número duro (ver `proof`). O Candado abria
 * antes e lia como conselho de bom senso: "jante proteína e feche a cozinha".
 * Conselho de bom senso ela já ouviu, não gera vontade de ver os outros seis.
 *
 * MUDAR ISTO MUDA O PLANO ENTREGUE, não só a página: o /mi-plan mostra o Día 1
 * de verdade antes do pagamento, e a promessa "este é o teu plano" só se
 * sustenta se a rotação aqui for a mesma dos dois lados. Planos já gerados não
 * mudam (ficam congelados no plan_json do pedido).
 */
const DELIVERY_ORDER = [
  'lleno', 'candado', 'arranque', 'inverso', 'blindaje', 'resistente', 'anticipo',
] as const

/** Os 7 na ordem em que ela os recebe. Use isto em qualquer UI que fale de
 *  "atajo 1, 2, 3…"; `COMBOS` é a ordem do acrônimo e daria numeração errada. */
export const COMBOS_IN_DELIVERY_ORDER: Combo[] = DELIVERY_ORDER.map((id) => COMBOS_BY_ID[id])

/**
 * Combo do dia. O ciclo tem 7 combos; o plano imprime 7 ou 28 dias, então a
 * rotação fecha certinho: cada dia da semana carrega sempre o mesmo combo, e em
 * 4 semanas ela repete cada um 4 vezes (é o que forma o hábito).
 */
export function comboForDay(dayNum: number): Combo {
  return COMBOS_IN_DELIVERY_ORDER[(dayNum - 1) % COMBOS_IN_DELIVERY_ORDER.length]
}

/** Ids de alimentos que só entram na lista de compras por causa dos combos. */
export const COMBO_INGREDIENT_IDS: string[] = Array.from(
  new Set(COMBOS.flatMap((c) => c.ingredientIds ?? [])),
)
