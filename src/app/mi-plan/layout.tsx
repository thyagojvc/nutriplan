import type { Metadata } from 'next'

// noindex: é uma página de funil, só faz sentido com a sessão do quiz atrás.
export const metadata: Metadata = {
  title: 'Tu plan · NutriPlan',
  robots: { index: false, follow: false },
}

export default function MiPlanLayout({ children }: { children: React.ReactNode }) {
  return children
}
