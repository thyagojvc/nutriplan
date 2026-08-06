import { NextResponse } from 'next/server'

// Servido explicitamente (em vez do arquivo de convenção manifest.ts) porque
// esse era o ponto do bug: manifest.ts injeta a tag <link rel="manifest">
// no <head> do site INTEIRO, mesmo com "scope": "/dashboard" dentro do JSON.
// O scope só vale depois de instalado — não impede o Chrome de oferecer
// "Instalar app" em /preview ou /quiz. Aqui a tag só é linkada dentro do
// layout do (dashboard) (ver metadata.manifest lá), então só existe
// oportunidade de instalação pra quem já comprou.
export function GET() {
  return NextResponse.json(
    {
      name: 'Método CALIBRA',
      short_name: 'Método CALIBRA',
      description: 'Tu Calibración Metabólica: cuánto comer exacto para tu cuerpo y tu objetivo.',
      start_url: '/dashboard',
      scope: '/dashboard',
      display: 'standalone',
      background_color: '#F8F7F1',
      theme_color: '#226c45',
      icons: [
        { src: '/logo-calibra-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/logo-calibra-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/logo-calibra-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  )
}
