import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { PlanView } from '@/app/(dashboard)/dashboard/plan-view'
import type { NutritionPlanJson } from '@/lib/nutrition/types'

// Página admin: visualiza o plano de qualquer cliente.
// Acesso: /admin/view-plan?email=xxx@yyy.com&secret=SUA_ADMIN_SECRET

export default async function AdminViewPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; secret?: string }>
}) {
  const { email, secret } = await searchParams

  if (!secret || secret !== process.env.ADMIN_SECRET) return notFound()
  if (!email) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          Passa o parâmetro <code>email=xxx@yyy.com</code> na URL.
        </p>
      </main>
    )
  }

  const svc = createServiceClient()

  const { data: user } = await svc
    .from('users')
    .select('id, name, email')
    .eq('email', email)
    .maybeSingle()

  if (!user) {
    return <ErrorMsg>Usuário não encontrado: {email}</ErrorMsg>
  }

  const { data: order } = await svc
    .from('orders')
    .select('id, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!order) {
    return <ErrorMsg>Nenhum pedido encontrado para {email}</ErrorMsg>
  }

  const { data: plan } = await svc
    .from('nutrition_plans')
    .select('plan_json, session_id')
    .eq('order_id', order.id)
    .maybeSingle()

  if (!plan?.plan_json) {
    return <ErrorMsg>Plano não encontrado. Status do order: {order.status}</ErrorMsg>
  }

  const { data: docs } = await svc
    .from('generated_documents')
    .select('kind')
    .eq('order_id', order.id)
  const docKinds = (docs ?? []).map((d) => d.kind as string)

  let profile = {
    age: null as number | null,
    weightKg: null as number | null,
    heightCm: null as number | null,
    sex: '',
    activityLevel: '',
  }
  const sessionId = (plan as unknown as { session_id?: string }).session_id
  if (sessionId) {
    const { data: session } = await svc
      .from('generation_sessions')
      .select('draft_answers')
      .eq('id', sessionId)
      .maybeSingle()
    const d = (session?.draft_answers ?? {}) as Record<string, unknown>
    const s4 = (d.step_4 ?? {}) as Record<string, unknown>
    const s5 = (d.step_5 ?? {}) as Record<string, unknown>
    const s6 = (d.step_6 ?? {}) as Record<string, unknown>
    profile = {
      age: Number(s5.age) || null,
      weightKg: Number(s5.weight_kg) || null,
      heightCm: Number(s5.height_cm) || null,
      sex: String(s4.sex ?? ''),
      activityLevel: String(s6.activity_level ?? ''),
    }
  }

  return (
    <div>
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 text-center">
        Visualização admin — plano de <strong>{user.name}</strong> ({user.email}) · order {order.status}
      </div>
      <PlanView
        plan={plan.plan_json as NutritionPlanJson}
        name={user.name ?? ''}
        docKinds={docKinds}
        profile={profile}
      />
    </div>
  )
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <p className="max-w-sm text-center text-sm text-red-600">{children}</p>
    </main>
  )
}
