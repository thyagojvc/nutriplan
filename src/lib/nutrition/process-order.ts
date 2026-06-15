// =============================================================================
// NutriPlan — Orquestrador do worker de geração (Fase C)
// processPaidOrder(orderId): transição atômica paid→generating, gera os planos,
// salva, conclui generating→delivered. Em falha: needs_review + fila manual.
//
// Atomicidade (spec T6): só o "vencedor" da transição paid→generating gera.
// A condição .eq('status','paid') no UPDATE garante que duas execuções
// concorrentes não gerem o mesmo pedido duas vezes.
// =============================================================================

import { createServiceClient } from '@/lib/supabase/service'
import { parseAnswers } from './answers'
import { calcTargets } from './math'
import { generateNutritionPlan, generateTrainingPlan } from './generate'

type ProcessResult =
  | { ok: true; status: 'delivered'; orderId: string }
  | { ok: false; status: 'skipped' | 'needs_review'; orderId: string; reason: string }

export async function processPaidOrder(orderId: string): Promise<ProcessResult> {
  const supabase = createServiceClient()

  // 1. Transição atômica paid → generating (só o vencedor prossegue)
  const { data: claimed } = await supabase
    .from('orders')
    .update({ status: 'generating', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'paid')
    .select('id, user_id, session_id')
    .maybeSingle()

  if (!claimed) {
    // Já estava generating/delivered, ou não está pago. Nada a fazer.
    return { ok: false, status: 'skipped', orderId, reason: 'not_paid_or_already_claimed' }
  }

  try {
    const userId = claimed.user_id as string | null
    const sessionId = claimed.session_id as string | null
    if (!userId || !sessionId) {
      throw new Error(`order ${orderId} sem user_id ou session_id`)
    }

    // 2. Carregar respostas do quiz e país
    const { data: session } = await supabase
      .from('generation_sessions')
      .select('draft_answers, country')
      .eq('id', sessionId)
      .single()

    if (!session?.country) {
      throw new Error(`session ${sessionId} sem país (quiz incompleto)`)
    }

    const answers = parseAnswers(
      (session.draft_answers ?? {}) as Record<string, unknown>,
      session.country as string,
    )
    const targets = calcTargets(answers)

    // 3. Detectar se o pedido inclui treino (order bump)
    const { data: items } = await supabase
      .from('order_items')
      .select('kind')
      .eq('order_id', orderId)
    const hasTraining = (items ?? []).some((it) => it.kind === 'training')

    // 4. Gerar e salvar plano nutricional (sempre)
    const nutritionPlan = await generateNutritionPlan(answers, targets)
    const { error: nutErr } = await supabase.from('nutrition_plans').upsert(
      {
        order_id: orderId,
        user_id: userId,
        session_id: sessionId,
        cycle_days: 7,
        cycle_weeks: 4,
        clinical_flags: answers.health,
        general_guidance: answers.generalGuidance,
        plan_json: nutritionPlan,
        model_used: nutritionPlan.generatedBy,
        prompt_version: nutritionPlan.promptVersion,
      },
      { onConflict: 'order_id' },
    )
    if (nutErr) throw new Error(`nutrition_plans upsert: ${nutErr.message}`)

    // 5. Gerar e salvar plano de treino (condicional)
    if (hasTraining) {
      const trainingPlan = await generateTrainingPlan(answers)
      const { error: trErr } = await supabase.from('training_plans').upsert(
        {
          order_id: orderId,
          user_id: userId,
          session_id: sessionId,
          clinical_flags: answers.health,
          limitations: answers.training.limitations,
          plan_json: trainingPlan,
          model_used: trainingPlan.generatedBy,
          prompt_version: trainingPlan.promptVersion,
        },
        { onConflict: 'order_id' },
      )
      if (trErr) throw new Error(`training_plans upsert: ${trErr.message}`)
    }

    // 6. Concluir: generating → delivered
    const { error: delErr } = await supabase
      .from('orders')
      .update({ status: 'delivered', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'generating')
    if (delErr) throw new Error(`delivered transition: ${delErr.message}`)

    return { ok: true, status: 'delivered', orderId }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error('[process-order] falha na geração:', orderId, reason)
    await moveToNeedsReview(orderId, reason)
    return { ok: false, status: 'needs_review', orderId, reason }
  }
}

/** Falha na geração: pedido → needs_review + linha em manual_review_queue. */
async function moveToNeedsReview(orderId: string, reason: string) {
  const supabase = createServiceClient()

  await supabase
    .from('orders')
    .update({ status: 'needs_review', updated_at: new Date().toISOString() })
    .eq('id', orderId)

  // unique(order_id): incrementa review_count se já existir
  await supabase.from('manual_review_queue').upsert(
    {
      order_id: orderId,
      plan_kind: 'nutrition',
      reason: 'generation_failed',
      status: 'open',
      details: { error: reason },
    },
    { onConflict: 'order_id' },
  )
}
