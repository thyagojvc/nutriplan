-- =============================================================================
-- NUTRIPLAN — MIGRATION 0020_atomic_track_funnel_event
--
-- PROBLEMA: /api/quiz/track-event fazia SELECT draft_answers -> merge em JS ->
-- UPDATE (substitui a coluna inteira). Quando dois eventos disparam próximos
-- (ex: scroll rápido cruza offer_reached e tiers_reached quase junto), as duas
-- requisições leem o MESMO estado antigo e a que grava por último sobrescreve
-- o campo que a outra tinha acabado de adicionar (read-modify-write race).
-- Sintoma real observado: sessão de uma compradora real tinha _ev_tiers_reached
-- mas não _ev_offer_reached, mesmo tendo claramente passado pelos dois.
--
-- SOLUÇÃO: mesmo padrão já usado em save_quiz_draft_step (migration 0013) —
-- merge atômico via operador jsonb || dentro do próprio UPDATE, sem round-trip
-- de leitura no meio. Duas escritas concorrentes não se apagam mais.
-- =============================================================================

CREATE OR REPLACE FUNCTION track_funnel_event(
  p_session_id uuid,
  p_key        text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE generation_sessions
    SET draft_answers = draft_answers || jsonb_build_object(p_key, now()::text),
        updated_at    = now()
    WHERE id = p_session_id;
END;
$$;

-- =============================================================================
-- FIM 0020_atomic_track_funnel_event
-- =============================================================================
