import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        <h1 className="text-2xl font-bold">Tu plan nutricional</h1>
        <p className="text-sm text-muted-foreground">
          Bienvenido, {user?.email}
        </p>
        {/* TODO: cards de plano, download de PDF, etc. */}
        <p className="text-xs text-muted-foreground">
          Dashboard — implementação completa nas fases B-D
        </p>
      </div>
    </main>
  )
}
