import type { MetadataRoute } from 'next'

// PWA: permite "instalar" o NutriPlan na tela inicial do celular (ícone + tela
// cheia), reaproveitando o app web existente. Servido em /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NutriPlan — Tu plan nutricional personalizado',
    short_name: 'NutriPlan',
    description: 'Tu Calibración Metabólica: cuánto comer exacto para tu cuerpo y tu objetivo.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#226c45',
    icons: [
      { src: '/logo-perfil.png', sizes: '192x192', type: 'image/png' },
      { src: '/logo-perfil.png', sizes: '512x512', type: 'image/png' },
      { src: '/logo-perfil.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
