// Gera a capa 600x600 do order bump (Plan de Entrenamiento) em PNG.
// Uso: node scripts/gen-bump-cover.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const OUT_DIR = 'hotmart-assets'
const OUT = `${OUT_DIR}/cover-plan-entrenamiento-600x600.png`

const svg = `
<svg width="600" height="600" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1E6340"/>
      <stop offset="1" stop-color="#143E27"/>
    </linearGradient>
  </defs>

  <rect width="600" height="600" fill="url(#bg)"/>
  <circle cx="540" cy="70" r="170" fill="#FFFFFF" opacity="0.05"/>
  <circle cx="60" cy="560" r="150" fill="#FFFFFF" opacity="0.05"/>

  <!-- Logo -->
  <circle cx="300" cy="158" r="54" fill="#FFFFFF"/>
  <g transform="translate(273.6,131.6) scale(2.2)">
    <path d="M12 2.5C7.5 2.5 3.5 6.8 3.5 12C3.5 16.4 6.2 20 10 21.8L12 22.5L14 21.8C17.8 20 20.5 16.4 20.5 12C20.5 6.8 16.5 2.5 12 2.5Z" fill="#1E6340"/>
    <path d="M12 21.5V11.5" stroke="#A7E8C4" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M12 17.5L9 14.5" stroke="#A7E8C4" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M12 14.5L15 11.5" stroke="#A7E8C4" stroke-width="1.1" stroke-linecap="round"/>
  </g>

  <text x="300" y="252" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#A7E8C4" font-weight="bold" letter-spacing="1.5">NutriPlan</text>

  <rect x="268" y="278" width="64" height="4" rx="2" fill="#A7E8C4"/>

  <text x="300" y="358" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="50" fill="#FFFFFF" font-weight="bold">Plan de</text>
  <text x="300" y="414" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="50" fill="#FFFFFF" font-weight="bold">Entrenamiento</text>

  <rect x="185" y="448" width="230" height="42" rx="21" fill="none" stroke="#A7E8C4" stroke-width="2"/>
  <text x="300" y="475" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#FFFFFF" font-weight="bold" letter-spacing="2">PERSONALIZADO</text>

  <text x="300" y="548" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="17" fill="#A7E8C4">Complemento de tu Plan Nutricional</text>
</svg>
`

await mkdir(OUT_DIR, { recursive: true })
await sharp(Buffer.from(svg)).png().toFile(OUT)
console.log('OK ->', OUT)
