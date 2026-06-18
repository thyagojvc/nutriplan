// =============================================================================
// NutriPlan — Orquestrador do worker de geração (Fase C)
// processPaidOrder(orderId): transição atômica paid→generating, gera os planos,
// salva, conclui generating→delivered. Em falha: needs_review + fila manual.
//
// Atomicidade (spec T6): só o "vencedor" da transição paid→generating gera.
// A condição .eq('status','paid') no UPDATE garante que duas execuções
// concorrentes não gerem o mesmo pedido duas vezes.
// =============================================================================

import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { parseAnswers } from './answers'
import { calcTargets } from './math'
import { generateNutritionPlan, generateTrainingPlan, type PhaseNumber } from './generate'
import { renderNutritionPdf, renderTrainingPdf } from './pdf'
import type { NutritionPlanJson } from './types'
import type { TrainingPlanJson } from './generate'

const DOCS_BUCKET = 'documents'

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
    .select('id, user_id, session_id, subscription_cycle')
    .maybeSingle()

  if (!claimed) {
    // Já estava generating/delivered, ou não está pago. Nada a fazer.
    return { ok: false, status: 'skipped', orderId, reason: 'not_paid_or_already_claimed' }
  }

  try {
    const userId = claimed.user_id as string | null
    const sessionId = claimed.session_id as string | null
    const subscriptionCycle = (claimed.subscription_cycle as number) ?? 1
    if (!userId || !sessionId) {
      throw new Error(`order ${orderId} sem user_id ou session_id`)
    }

    // Fase derivada do ciclo: 1→1, 2→2, 3+→3
    const phaseNumber = (Math.min(subscriptionCycle, 3)) as PhaseNumber

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

    // 2b. Check-in do ciclo atual (fases 2 e 3)
    const checkin = phaseNumber > 1
      ? await loadCheckinForOrder(orderId, userId)
      : undefined

    // 3. Detectar se o pedido inclui treino (order bump)
    const { data: items } = await supabase
      .from('order_items')
      .select('kind')
      .eq('order_id', orderId)
    const hasTraining = (items ?? []).some((it) => it.kind === 'training')

    // 4. Gerar e salvar plano nutricional (sempre)
    const nutritionPlan = await generateNutritionPlan(answers, targets, phaseNumber, checkin)
    const { error: nutErr } = await supabase.from('nutrition_plans').upsert(
      {
        order_id: orderId,
        user_id: userId,
        session_id: sessionId,
        cycle_days: 7,
        cycle_weeks: 4,
        phase_number: phaseNumber,
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
    let trainingPlan: TrainingPlanJson | null = null
    if (hasTraining) {
      trainingPlan = await generateTrainingPlan(answers)
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

    // 6. PDFs complementares (Decisão 16). NÃO bloqueiam a entrega: o dashboard
    //    HTML é a entrega primária. Falha aqui é logada, não manda a needs_review.
    try {
      const { data: u } = await supabase
        .from('users')
        .select('name')
        .eq('id', userId)
        .maybeSingle()
      await generateAndStoreDocuments(
        orderId,
        userId,
        u?.name ?? '',
        nutritionPlan,
        trainingPlan,
      )
    } catch (pdfErr) {
      console.error('[process-order] falha ao gerar PDFs (não bloqueante):', orderId, pdfErr)
    }

    // 7. Concluir: generating → delivered
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

/**
 * Gera os PDFs, faz upload no bucket privado e registra em generated_documents.
 * Reprocessamento usa DELETE+INSERT (campos imutáveis por linha, migration 0006).
 */
async function generateAndStoreDocuments(
  orderId: string,
  userId: string,
  name: string,
  nutritionPlan: NutritionPlanJson,
  trainingPlan: TrainingPlanJson | null,
) {
  const supabase = createServiceClient()

  const docs: { kind: string; fileName: string; buffer: Buffer }[] = [
    {
      kind: 'nutrition_plan',
      fileName: 'plan-nutricional.pdf',
      buffer: await renderNutritionPdf(nutritionPlan, name),
    },
  ]
  if (trainingPlan) {
    docs.push({
      kind: 'training_plan',
      fileName: 'plan-entrenamiento.pdf',
      buffer: await renderTrainingPdf(trainingPlan, name),
    })
  }

  for (const doc of docs) {
    const storagePath = `${userId}/${orderId}/${doc.kind}.pdf`
    const checksum = createHash('sha256').update(doc.buffer).digest('hex')

    const { error: upErr } = await supabase.storage
      .from(DOCS_BUCKET)
      .upload(storagePath, doc.buffer, {
        contentType: 'application/pdf',
        upsert: true,
      })
    if (upErr) throw new Error(`storage upload ${doc.kind}: ${upErr.message}`)

    // DELETE+INSERT (unique(order_id,kind); campos imutáveis bloqueiam UPDATE)
    await supabase
      .from('generated_documents')
      .delete()
      .eq('order_id', orderId)
      .eq('kind', doc.kind)

    const { error: insErr } = await supabase.from('generated_documents').insert({
      user_id: userId,
      order_id: orderId,
      kind: doc.kind,
      storage_path: storagePath,
      file_name: doc.fileName,
      checksum,
    })
    if (insErr) throw new Error(`generated_documents insert ${doc.kind}: ${insErr.message}`)
  }
}

/** Carrega dados do check-in associado a este pedido (se o usuário já completou). */
async function loadCheckinForOrder(orderId: string, userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('user_checkins')
    .select('current_weight_kg, adherence_rating')
    .eq('order_id', orderId)
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .maybeSingle()
  if (!data) return undefined
  return {
    currentWeightKg: data.current_weight_kg ?? undefined,
    adherenceRating: data.adherence_rating ?? undefined,
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
