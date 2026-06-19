import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { NutritionPlanJson } from '@/lib/nutrition/types'
import { PlanView } from './plan-view'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware já protege a rota; se chegou aqui sem user, mostra fallback.
  if (!user) return <Centered>Inicia sesión para ver tu plan.</Centered>

  // Buscamos via service_role mas SEMPRE escopado pelo id do usuário autenticado.
  const svc = createServiceClient()

  const { data: publicUser } = await svc
    .from('users')
    .select('id, name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!publicUser) return <Centered>No encontramos tu cuenta.</Centered>

  const { data: order } = await svc
    .from('orders')
    .select('id, status')
    .eq('user_id', publicUser.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!order) {
    return <Centered>Aún no tienes un pedido. Completa el cuestionario para generar tu plan.</Centered>
  }

  // Estados de processamento
  if (order.status === 'refunded') {
    return <Centered>El acceso a este plan fue cancelado.</Centered>
  }

  if (order.status === 'paid' || order.status === 'generating') {
    return (
      <Processing
        title="Estamos preparando tu plan"
        message="Tu plan personalizado se está generando. Esto suele tardar unos segundos. Recarga la página en un momento."
      />
    )
  }

  if (order.status === 'needs_review') {
    return (
      <Processing
        title="Tu plan está en revisión"
        message="Estamos revisando tu plan para asegurar que cumpla con tus restricciones. Te avisaremos por correo en cuanto esté listo."
      />
    )
  }

  // delivered → carregar e renderizar
  const { data: plan } = await svc
    .from('nutrition_plans')
    .select('plan_json, session_id')
    .eq('order_id', order.id)
    .maybeSingle()

  if (!plan?.plan_json) {
    return (
      <Processing
        title="Estamos preparando tu plan"
        message="Tu plan se está finalizando. Recarga la página en un momento."
      />
    )
  }

  // PDFs disponíveis para download
  const { data: docs } = await svc
    .from('generated_documents')
    .select('kind')
    .eq('order_id', order.id)
  const docKinds = (docs ?? []).map((d) => d.kind as string)

  // Perfil físico do usuário (draft_answers da sessão)
  let profile = { age: null as number | null, weightKg: null as number | null, heightCm: null as number | null, sex: '', activityLevel: '' }
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
    <PlanView
      plan={plan.plan_json as NutritionPlanJson}
      name={publicUser.name ?? ''}
      docKinds={docKinds}
      profile={profile}
    />
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <p className="max-w-sm text-center text-sm text-muted-foreground">{children}</p>
    </main>
  )
}

function Processing({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="flex justify-center">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
        </div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  )
}
