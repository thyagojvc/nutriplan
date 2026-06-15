import { Suspense } from 'react'
import { SuccessPoller } from './success-poller'

export default function ExitoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<ExitoSkeleton />}>
        <SuccessPoller />
      </Suspense>
    </main>
  )
}

function ExitoSkeleton() {
  return (
    <div className="w-full max-w-sm space-y-4 text-center">
      <div className="h-8 w-32 animate-pulse rounded bg-muted mx-auto" />
      <div className="h-4 w-64 animate-pulse rounded bg-muted mx-auto" />
    </div>
  )
}
