import type { MetadataRoute } from 'next'

// PWA: permite "instalar" o NutriPlan na tela inicial do celular (ícone + tela
// cheia), reaproveitando o app web existente. Servido em /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NutriPlan — Tu plan nutricional personalizado',
    short_name: 'NutriPlan',
    description: 'Tu NutriPlan: cuánto comer exacto para tu cuerpo y tu objetivo.',
    start_url: '/dashboard',
    // Sem scope explícito, o padrão vira '/' (domínio inteiro): o navegador
    // passa a considerar até /quiz e /preview como parte do "app instalável"
    // e pode disparar o prompt nativo de instalação bem na 1ª pergunta do
    // quiz — fricção extra exatamente onde não pode ter nenhuma. O app só
    // deve ser oferecido pra quem já comprou e está no /dashboard.
    scope: '/dashboard',
    display: 'standalone',
    background_color: '#F8F7F1',
    theme_color: '#226c45',
    icons: [
      { src: '/logo-perfil.png', sizes: '192x192', type: 'image/png' },
      { src: '/logo-perfil.png', sizes: '512x512', type: 'image/png' },
      { src: '/logo-perfil.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
