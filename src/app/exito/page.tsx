import { Suspense } from 'react'
import { SuccessPoller } from './success-poller'
import { NutriWordmark } from '@/app/quiz/[step]/quiz-ui'

export default function ExitoPage() {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'linear-gradient(180deg, hsl(148,38%,90%) 0px, hsl(148,28%,95%) 90px, hsl(80,18%,97%) 220px)',
      }}
    >
      <header className="sticky top-0 z-20 flex h-14 items-center justify-center border-b border-[#D4E8D0] bg-white/85 backdrop-blur-md">
        <NutriWordmark size="md" />
      </header>

      <main className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4 py-10">
        <Suspense fallback={<ExitoSkeleton />}>
          <SuccessPoller />
        </Suspense>
      </main>
    </div>
  )
}

function ExitoSkeleton() {
  return (
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="h-20 w-20 animate-pulse rounded-full bg-[#D8E8D4] mx-auto" />
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-xl bg-[#D8E8D4] mx-auto" />
        <div className="h-4 w-40 animate-pulse rounded bg-[#EAF2E6] mx-auto" />
      </div>
      <div className="h-32 w-full animate-pulse rounded-2xl bg-[#EAF2E6]" />
    </div>
  )
}
