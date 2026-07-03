// Mapeamento de label de alimento → foto do ingrediente.
// Chaves são substrings lowercase do label (mais específica primeiro).
// CDN Spoonacular: ingredientes em inglês, lowercase-hyphenated.
// Pexels: IDs verificados visualmente.

const CDN = 'https://spoonacular.com/cdn/ingredients_250x250'
const px = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop`

// Keys em lowercase; o lookup faz label.toLowerCase().includes(key).
// Ordem importa: chaves mais específicas primeiro para evitar match errado.
const FOOD_IMAGE_MAP: Record<string, string> = {
  // ── Proteínas ────────────────────────────────────────────────────────────────
  'pechuga de pollo':        `${CDN}/chicken-breasts.jpg`,
  'pechuga de pavo':         `${CDN}/turkey-breast.jpg`,
  'carne de res':            `${CDN}/flank-steak.jpg`,
  'lomo de cerdo':           `${CDN}/pork-chops.jpg`,
  'filete de pescado':       `${CDN}/fish-fillet.jpg`,
  'salmón':                  `${CDN}/salmon.jpg`,
  salmon:                    `${CDN}/salmon.jpg`,
  camarones:                 `${CDN}/shrimp.jpg`,
  mariscos:                  `${CDN}/shrimp.jpg`,
  'atún':                    px(3655916),
  atun:                      px(3655916),
  huevo:                     `${CDN}/egg.jpg`,
  'tofu firme':              `${CDN}/tofu.jpg`,
  tofu:                      `${CDN}/tofu.jpg`,
  'lentejas / frijoles':     `${CDN}/black-beans.jpg`,
  lentejas:                  `${CDN}/black-beans.jpg`,
  frijoles:                  `${CDN}/black-beans.jpg`,
  legumbre:                  `${CDN}/black-beans.jpg`,
  // ── Carboidratos ─────────────────────────────────────────────────────────────
  'arroz cocido':            px(1640772),
  arroz:                     px(1640772),
  'pasta cocida':            `${CDN}/spaghetti.jpg`,
  pasta:                     `${CDN}/spaghetti.jpg`,
  'pan integral':            `${CDN}/whole-wheat-bread.jpg`,
  avena:                     `${CDN}/rolled-oats.jpg`,
  'papa cocida':             `${CDN}/potatoes-yukon-gold.jpg`,
  papa:                      `${CDN}/potatoes-yukon-gold.jpg`,
  'quinoa cocida':           `${CDN}/cooked-quinoa.jpg`,
  quinoa:                    `${CDN}/cooked-quinoa.jpg`,
  'camote / batata':         `${CDN}/sweet-potato.jpg`,
  camote:                    `${CDN}/sweet-potato.jpg`,
  batata:                    `${CDN}/sweet-potato.jpg`,
  granola:                   `${CDN}/granola.jpg`,
  'tortilla de maíz':        `${CDN}/corn-tortillas.jpg`,
  'tortilla de maiz':        `${CDN}/corn-tortillas.jpg`,
  tortilla:                  `${CDN}/corn-tortillas.jpg`,
  'arepa de maíz':           `${CDN}/cornmeal.jpg`,
  'arepa de maiz':           `${CDN}/cornmeal.jpg`,
  arepa:                     `${CDN}/cornmeal.jpg`,
  'plátano maduro cocido':   `${CDN}/plantains.jpg`,
  'plátano maduro':          `${CDN}/plantains.jpg`,
  'yuca cocida':             `${CDN}/cassava.jpg`,
  yuca:                      `${CDN}/cassava.jpg`,
  // ── Vegetais ─────────────────────────────────────────────────────────────────
  'verduras mixtas':         px(1300975),
  verduras:                  px(1300975),
  'tomate / ensalada':       `${CDN}/tomato.jpg`,
  tomate:                    `${CDN}/tomato.jpg`,
  ensalada:                  `${CDN}/romaine-lettuce.jpg`,
  espinaca:                  `${CDN}/spinach.jpg`,
  // nopales: sem imagem verificada — onError esconde silenciosamente
  'brócoli':                 `${CDN}/broccoli.jpg`,
  brocoli:                   `${CDN}/broccoli.jpg`,
  zanahoria:                 `${CDN}/carrots.jpg`,
  'calabacín':               `${CDN}/zucchini.jpg`,
  calabacin:                 `${CDN}/zucchini.jpg`,
  'ejotes / judías verdes':  px(1580466),
  ejotes:                    px(1580466),
  'judías verdes':           px(1580466),
  'champiñones':             `${CDN}/mushrooms.jpg`,
  champinones:               `${CDN}/mushrooms.jpg`,
  pimiento:                  `${CDN}/red-bell-pepper.jpg`,
  coliflor:                  `${CDN}/cauliflower.jpg`,
  pepino:                    `${CDN}/cucumber.jpg`,
  // ── Frutas ───────────────────────────────────────────────────────────────────
  'fruta de temporada':      px(1132047),
  frutas:                    px(1132047),
  fruta:                     px(1132047),
  manzana:                   `${CDN}/apple.jpg`,
  'plátano / banana':        `${CDN}/bananas.jpg`,
  banana:                    `${CDN}/bananas.jpg`,
  plátano:                   `${CDN}/plantains.jpg`,
  platano:                   `${CDN}/plantains.jpg`,
  fresas:                    `${CDN}/strawberries.jpg`,
  fresa:                     `${CDN}/strawberries.jpg`,
  papaya:                    `${CDN}/papaya.jpg`,
  'piña':                    `${CDN}/pineapple.jpg`,
  pina:                      `${CDN}/pineapple.jpg`,
  mango:                     `${CDN}/mango.jpg`,
  naranja:                   `${CDN}/orange.jpg`,
  // ── Gorduras e laticínios ─────────────────────────────────────────────────────
  aguacate:                  `${CDN}/avocado.jpg`,
  'nueces / frutos secos':   `${CDN}/walnuts.jpg`,
  nueces:                    `${CDN}/walnuts.jpg`,
  almendras:                 `${CDN}/almonds.jpg`,
  'yogur griego':            `${CDN}/plain-yogurt.jpg`,
  'yogur natural / leche':   `${CDN}/plain-yogurt.jpg`,
  yogur:                     `${CDN}/plain-yogurt.jpg`,
  leche:                     `${CDN}/milk.jpg`,
  'queso fresco / panela':   `${CDN}/cream-cheese.jpg`,
  'queso fresco':            `${CDN}/cream-cheese.jpg`,
  queso:                     `${CDN}/cream-cheese.jpg`,
  'aceite de oliva':         `${CDN}/olive-oil.jpg`,
  aceite:                    `${CDN}/olive-oil.jpg`,
}

/** Retorna a URL da foto para um label de alimento, ou null se não mapeado. */
export function getFoodImageUrl(label: string): string | null {
  const lower = label.toLowerCase()
  for (const [key, url] of Object.entries(FOOD_IMAGE_MAP)) {
    if (lower.includes(key)) return url
  }
  return null
}
