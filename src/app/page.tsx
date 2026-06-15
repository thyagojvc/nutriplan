import { redirect } from 'next/navigation'

// Landing page provisória — redireciona para o quiz enquanto não há página de marketing
export default function HomePage() {
  redirect('/quiz/1')
}
