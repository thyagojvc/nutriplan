// Gerador de slides de carrossel para Instagram (1080x1080) com a identidade NutriPlan.
// Rodar: node scripts/instagram-carousels.mjs
// Cada post vai para sua própria subpasta em public/instagram/<postX>/.
// Edite os arrays POSTS abaixo e rode de novo para regenerar.

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = join(__dirname, '..', 'public', 'instagram')

// ── Tokens de marca ────────────────────────────────────────────────
const C = {
  greenDeep: '#1E6340',
  green: '#226D45',
  cream: '#F5FAF2',
  ink: '#1A2E22',
  gray: '#5B6B60',
  greenSoft: '#EBF6E4',
  red: '#E5484D',
  mint: '#A7E8C4',
}
const FONT = 'Arial, Helvetica, sans-serif'

// ── Folha (logo) como grupo SVG posicionável ───────────────────────
function leaf(cx, cy, size, leafColor, veinColor) {
  const s = size / 24
  const tx = cx - size / 2
  const ty = cy - size / 2
  return `
  <g transform="translate(${tx} ${ty}) scale(${s})">
    <path d="M12 2.5C7.5 2.5 3.5 6.8 3.5 12C3.5 16.4 6.2 20 10 21.8L12 22.5L14 21.8C17.8 20 20.5 16.4 20.5 12C20.5 6.8 16.5 2.5 12 2.5Z" fill="${leafColor}"/>
    <path d="M12 21.5V11.5" stroke="${veinColor}" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M12 17.5L9 14.5" stroke="${veinColor}" stroke-width="1.1" stroke-linecap="round" opacity="0.85"/>
    <path d="M12 14.5L15 11.5" stroke="${veinColor}" stroke-width="1.1" stroke-linecap="round" opacity="0.85"/>
  </g>`
}

// ── Quebra de texto por largura aproximada ─────────────────────────
function wrap(text, fontSize, maxWidth, factor = 0.56) {
  const maxChars = Math.max(6, Math.floor(maxWidth / (fontSize * factor)))
  const words = text.split(' ')
  const lines = []
  let cur = ''
  for (const w of words) {
    const tryLine = cur ? cur + ' ' + w : w
    if (tryLine.length > maxChars && cur) {
      lines.push(cur)
      cur = w
    } else {
      cur = tryLine
    }
  }
  if (cur) lines.push(cur)
  return lines
}

// Bloco de texto. Retorna { svg, height }
function textBlock(text, { x, top, fontSize, color, weight = 'bold', maxWidth, anchor = 'middle', lh = 1.2 }) {
  const lines = wrap(text, fontSize, maxWidth)
  const lineH = fontSize * lh
  const tspans = lines
    .map((ln, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineH}">${esc(ln)}</tspan>`)
    .join('')
  const svg = `<text x="${x}" y="${top + fontSize}" font-family="${FONT}" font-size="${fontSize}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${tspans}</text>`
  return { svg, height: lineH * (lines.length - 1) + fontSize }
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pill(cx, cy, label) {
  const w = 560, h = 96
  return `
  <rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="48" fill="#FFFFFF"/>
  <text x="${cx}" y="${cy + 14}" font-family="${FONT}" font-size="38" font-weight="bold" fill="${C.green}" text-anchor="middle">${esc(label)}</text>`
}

function handle(color) {
  return `<text x="540" y="1000" font-family="${FONT}" font-size="30" font-weight="bold" fill="${color}" text-anchor="middle" opacity="0.85">@mi.nutriplan</text>`
}

function dots(total, active, color) {
  const gap = 28, r = 7
  const startX = 540 - ((total - 1) * gap) / 2
  let out = ''
  for (let i = 0; i < total; i++) {
    out += `<circle cx="${startX + i * gap}" cy="80" r="${r}" fill="${color}" opacity="${i === active ? 1 : 0.3}"/>`
  }
  return out
}

// Selo "X" vermelho (mito) e selo "✓" verde (verdade)
function xBadge(cx, cy, r) {
  const o = r * 0.4
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.red}"/>
  <path d="M${cx - o} ${cy - o} L${cx + o} ${cy + o} M${cx + o} ${cy - o} L${cx - o} ${cy + o}" stroke="#FFFFFF" stroke-width="${r * 0.16}" stroke-linecap="round"/>`
}

function playButton(cx, cy, r) {
  const t = r * 0.45
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF"/>
  <path d="M${cx - t * 0.5} ${cy - t} L${cx + t} ${cy} L${cx - t * 0.5} ${cy + t} Z" fill="${C.green}"/>`
}

function checkCircle(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.green}"/>
  <path d="M${cx - r * 0.42} ${cy} L${cx - r * 0.08} ${cy + r * 0.36} L${cx + r * 0.46} ${cy - r * 0.36}" stroke="#FFFFFF" stroke-width="${r * 0.22}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
}

function starRow(cx, cy, size) {
  const gap = size * 1.35
  const startX = cx - (4 * gap) / 2
  let out = ''
  for (let i = 0; i < 5; i++) {
    const x = startX + i * gap
    out += `<path transform="translate(${x - size / 2} ${cy - size / 2}) scale(${size / 11})" d="M5.5 1l1.1 3.3H10L7.2 6.4l1 3.1L5.5 7.7 2.8 9.5l1-3.1L1 4.3h3.4z" fill="#f59e0b"/>`
  }
  return out
}

// ── Tipos de slide ─────────────────────────────────────────────────

function coverSlide({ kicker, title, accent, total, active }) {
  const t1 = textBlock(title, { x: 540, top: 360, fontSize: 78, color: '#FFFFFF', maxWidth: 860, lh: 1.12 })
  const accentBlock = accent
    ? textBlock(accent, { x: 540, top: 360 + t1.height + 36, fontSize: 78, color: C.mint, maxWidth: 860, lh: 1.12 }).svg
    : ''
  const kickerSvg = kicker
    ? `<text x="540" y="270" font-family="${FONT}" font-size="32" font-weight="bold" fill="${C.mint}" text-anchor="middle" letter-spacing="2">${esc(kicker.toUpperCase())}</text>`
    : ''
  return `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1080" fill="${C.greenDeep}"/>
    ${dots(total, active, '#FFFFFF')}
    ${leaf(540, 150, 96, '#FFFFFF', C.greenDeep)}
    ${kickerSvg}
    ${t1.svg}
    ${accentBlock}
    ${handle('#FFFFFF')}
  </svg>`
}

function contentSlide({ title, body, total, active }) {
  const t = textBlock(title, { x: 540, top: 340, fontSize: 70, color: C.green, maxWidth: 880, lh: 1.14 })
  const b = textBlock(body, { x: 540, top: 340 + t.height + 50, fontSize: 44, color: C.gray, weight: 'normal', maxWidth: 860, lh: 1.32 })
  return `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1080" fill="${C.cream}"/>
    ${dots(total, active, C.green)}
    ${leaf(540, 150, 80, C.green, '#FFFFFF')}
    ${t.svg}
    ${b.svg}
    ${handle(C.green)}
  </svg>`
}

function ctaSlide({ title, ctaLabel, total, active }) {
  const t = textBlock(title, { x: 540, top: 330, fontSize: 74, color: '#FFFFFF', maxWidth: 880, lh: 1.14 })
  return `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1080" fill="${C.greenDeep}"/>
    ${dots(total, active, '#FFFFFF')}
    ${leaf(540, 150, 96, '#FFFFFF', C.greenDeep)}
    ${t.svg}
    ${pill(540, 720, ctaLabel)}
    <text x="540" y="830" font-family="${FONT}" font-size="36" font-weight="bold" fill="${C.mint}" text-anchor="middle">link en la bio</text>
    ${handle('#FFFFFF')}
  </svg>`
}

// Slide de mito: selo X vermelho + frase falsa + a verdade
function mythSlide({ myth, truth, total, active }) {
  const m = textBlock('"' + myth + '"', { x: 540, top: 380, fontSize: 58, color: C.ink, maxWidth: 880, lh: 1.16 })
  const truthTop = 380 + m.height + 56
  const kicker = `<text x="540" y="${truthTop + 26}" font-family="${FONT}" font-size="30" font-weight="bold" fill="${C.green}" text-anchor="middle" letter-spacing="4">LA VERDAD</text>`
  const t = textBlock(truth, { x: 540, top: truthTop + 56, fontSize: 44, color: C.gray, weight: 'normal', maxWidth: 860, lh: 1.3 })
  return `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1080" fill="${C.cream}"/>
    ${dots(total, active, C.green)}
    ${xBadge(540, 215, 72)}
    ${m.svg}
    ${kicker}
    ${t.svg}
    ${handle(C.green)}
  </svg>`
}

// Capa de Reel: gancho + botão de play (a capa que aparece no feed/grid)
function reelCover({ title }) {
  const t = textBlock(title, { x: 540, top: 360, fontSize: 74, color: '#FFFFFF', maxWidth: 880, lh: 1.16 })
  return `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1080" fill="${C.greenDeep}"/>
    ${leaf(540, 150, 96, '#FFFFFF', C.greenDeep)}
    ${t.svg}
    ${playButton(540, 760, 70)}
    ${handle('#FFFFFF')}
  </svg>`
}

// Slide de lista (checklist) — fundo creme, título verde, itens com check
function listSlide({ title, items, total, active }) {
  const t = textBlock(title, { x: 540, top: 300, fontSize: 64, color: C.green, maxWidth: 900, lh: 1.14 })
  let rows = ''
  const startY = 300 + t.height + 80
  const gap = 96
  items.forEach((item, i) => {
    const y = startY + i * gap
    rows += checkCircle(160, y - 12, 28)
    rows += `<text x="215" y="${y}" font-family="${FONT}" font-size="40" font-weight="normal" fill="${C.ink}" text-anchor="start">${esc(item)}</text>`
  })
  return `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1080" fill="${C.cream}"/>
    ${dots(total, active, C.green)}
    ${leaf(540, 150, 80, C.green, '#FFFFFF')}
    ${t.svg}
    ${rows}
    ${handle(C.green)}
  </svg>`
}

// Slide de depoimento — card branco com avatar, estrelas e citação
function testimonialSlide({ header, initials, color, quote, name, total, active }) {
  const q = textBlock('"' + quote + '"', { x: 540, top: 540, fontSize: 44, color: C.ink, weight: 'normal', maxWidth: 740, lh: 1.32 })
  const nameY = 540 + q.height + 80
  const headerSvg = header
    ? `<text x="540" y="210" font-family="${FONT}" font-size="38" font-weight="bold" fill="${C.green}" text-anchor="middle">${esc(header)}</text>`
    : ''
  return `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1080" fill="${C.cream}"/>
    ${dots(total, active, C.green)}
    ${headerSvg}
    <rect x="90" y="270" width="900" height="560" rx="44" fill="#FFFFFF" stroke="${C.greenSoft}" stroke-width="2"/>
    <circle cx="540" cy="375" r="55" fill="${color}"/>
    <text x="540" y="392" font-family="${FONT}" font-size="42" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${esc(initials)}</text>
    ${starRow(540, 475, 30)}
    ${q.svg}
    <text x="540" y="${nameY}" font-family="${FONT}" font-size="38" font-weight="bold" fill="${C.green}" text-anchor="middle">${esc(name)}</text>
    ${handle(C.green)}
  </svg>`
}

// ── CONTEÚDO DOS POSTS ─────────────────────────────────────────────
const POSTS = {
  post1: [
    coverSlide({ title: 'Tu cuerpo no necesita otra dieta.', accent: 'Necesita un plan a tu medida.', total: 3, active: 0 }),
    contentSlide({
      title: 'Hecho para nadie',
      body: 'La mayoría falla porque sigue planes genéricos de internet, calculados para "todos". Tu metabolismo, tu peso y tus gustos son únicos.',
      total: 3, active: 1,
    }),
    ctaSlide({ title: 'Calcula qué y cuánto comer en 3 minutos. Sin pasar hambre.', ctaLabel: 'Empieza gratis', total: 3, active: 2 }),
  ],

  post2: [
    coverSlide({ kicker: 'Nutrición', title: '¿Cuántas calorías necesitas en realidad?', total: 5, active: 0 }),
    contentSlide({
      title: 'No es 2.000 para todos',
      body: 'Tu gasto depende de 4 cosas: tu peso, tu altura, tu edad y cuánto te mueves. Cambiar una, cambia todo.',
      total: 5, active: 1,
    }),
    contentSlide({
      title: 'Por eso fallan las dietas de revista',
      body: 'Fueron calculadas para un cuerpo que no es el tuyo. Comer de más estanca tu progreso; comer de menos te hace abandonar.',
      total: 5, active: 2,
    }),
    contentSlide({
      title: 'La fórmula real: TMB + TDEE',
      body: 'Suena complicado, pero se calcula en segundos con tus datos. Es la base de todo plan que de verdad funciona.',
      total: 5, active: 3,
    }),
    ctaSlide({ title: 'Descubre TU número exacto. Gratis, en 3 minutos.', ctaLabel: 'Calcula tu plan', total: 5, active: 4 }),
  ],

  // Capa do Reel (o vídeo é a gravação de tela do quiz → preview; esta é a capa)
  post3: [
    reelCover({ title: 'Así de simple es saber qué comer para tu cuerpo' }),
  ],

  post4: [
    coverSlide({ title: '3 mentiras que te hicieron pasar hambre sin necesidad.', total: 5, active: 0 }),
    mythSlide({
      myth: 'Menos comida es mejor',
      truth: 'Comer muy poco frena tu metabolismo y te hace recuperar todo lo que bajaste.',
      total: 5, active: 1,
    }),
    mythSlide({
      myth: 'Los carbohidratos engordan',
      truth: 'El problema es la cantidad, no el alimento. Un buen plan los incluye en su justa medida.',
      total: 5, active: 2,
    }),
    mythSlide({
      myth: 'Necesitas fuerza de voluntad',
      truth: 'Necesitas un plan claro que te diga qué comer. Con eso, la disciplina deja de ser el problema.',
      total: 5, active: 3,
    }),
    ctaSlide({ title: 'Adelgazar no es pasar hambre. Es comer lo correcto.', ctaLabel: 'Calcula tu plan', total: 5, active: 4 }),
  ],

  post5: [
    coverSlide({ kicker: 'Tu plan incluye', title: 'Esto es todo lo que recibes', total: 3, active: 0 }),
    listSlide({
      title: 'En tu plan personalizado',
      items: [
        'Perfil nutricional exacto (IMC, TMB, TDEE)',
        'Plan de 30 días con porciones',
        'Lista de compras lista para usar',
        'Guía de implementación paso a paso',
        'Sustituciones para tu despensa',
        'PDF descargable para siempre',
      ],
      total: 3, active: 1,
    }),
    ctaSlide({ title: 'Todo calculado para ti. En solo 3 minutos.', ctaLabel: 'Quiero mi plan', total: 3, active: 2 }),
  ],

  post6: [
    testimonialSlide({
      header: 'Lo que dicen quienes ya lo tienen',
      initials: 'VR', color: '#f472b6',
      quote: 'Siempre pensé que tenía que pasar hambre. Bajé 5 kg en 6 semanas comiendo bien.',
      name: 'Valeria R. · México',
      total: 3, active: 0,
    }),
    testimonialSlide({
      initials: 'AM', color: '#60a5fa',
      quote: 'Con dos hijos no tenía tiempo de contar calorías. El plan me dijo exactamente qué comer.',
      name: 'Andrea M. · Colombia',
      total: 3, active: 1,
    }),
    testimonialSlide({
      initials: 'AP', color: '#34d399',
      quote: 'Comida real, sin dietas locas. En 3 semanas ya me sentía con más energía.',
      name: 'Ana P. · España',
      total: 3, active: 2,
    }),
  ],

  post7: [
    coverSlide({ title: 'Comes poco y aun así no bajas?', accent: 'Esto puede estar pasando.', total: 5, active: 0 }),
    contentSlide({
      title: 'Tu metabolismo se adaptó',
      body: 'Cuando comes muy poco por mucho tiempo, tu cuerpo gasta menos para protegerse. Bajar de más se vuelve cada vez más difícil.',
      total: 5, active: 1,
    }),
    contentSlide({
      title: 'No sabes tu número real',
      body: 'Sin conocer tu gasto exacto, es imposible saber si comes de más o de menos. Adivinar nunca funciona a largo plazo.',
      total: 5, active: 2,
    }),
    contentSlide({
      title: 'Comes "sano" pero sin medida',
      body: 'Hasta los alimentos saludables suman. Sin porciones claras, es fácil pasarte sin darte cuenta.',
      total: 5, active: 3,
    }),
    ctaSlide({ title: 'Descubre tu número exacto y deja de adivinar.', ctaLabel: 'Calcula tu plan', total: 5, active: 4 }),
  ],
}

// ── Render ─────────────────────────────────────────────────────────
async function render(svg, post, name) {
  const dir = join(BASE, post)
  mkdirSync(dir, { recursive: true })
  await sharp(Buffer.from(svg)).png().toFile(join(dir, name))
  console.log('✓', post + '/' + name)
}

for (const [post, slides] of Object.entries(POSTS)) {
  for (let i = 0; i < slides.length; i++) {
    const name = slides.length === 1 ? `${post}-cover.png` : `${post}-${i + 1}.png`
    await render(slides[i], post, name)
  }
}
console.log('\nPronto! Slides em public/instagram/<post>/')
