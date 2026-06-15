-- =============================================================================
-- NUTRIPLAN — MIGRATION 0013_draft_answers_country_nullable
-- Pré-requisito: Fase A — deve rodar ANTES de qualquer código da Fase A
-- Depende de: 0003 (generation_sessions), 0009 (leads, consent_records)
--
-- MUDANÇAS:
--   1. country nullable em generation_sessions
--      Motivo: sessão criada no step 1 do quiz, país só conhecido no step 7.
--              session_id é FK NOT NULL em questionnaire_answers → sessão deve
--              existir antes da 1ª resposta, portanto country não pode ser NOT NULL.
--
--   2. draft_answers jsonb — fonte de verdade do quiz
--      Motivo: sessionStorage é cache de UI; jsonb no banco garante recuperação
--              cross-device e evita dois sources of truth.
--
--   3. idx_gen_sessions_abandoned — índice parcial (lead_id IS NULL) para jobs
--      de limpeza de sessões abandonadas. Mais eficiente que índice simples em
--      updated_at porque filtra exatamente o conjunto que o job precisa varrer.
--
--   4. submit_quiz_step12_atomic — RPC com transação implícita + idempotência
--      Ordem: verificar idempotência → leads → consent_records → UPDATE session
--      Motivo: chk_consent_subject_ref (0009) exige lead_id IS NOT NULL para
--              subject_kind='lead'. Lead deve existir antes do consent na mesma tx.
--              Verificação de idempotência no início evita leads órfãos em double-submit.
--              A condição AND country IS NOT NULL valida que step 7 foi concluído.
-- =============================================================================

-- 1. Tornar country nullable (sessão criada antes de o país ser conhecido)
ALTER TABLE generation_sessions ALTER COLUMN country DROP NOT NULL;

-- 2. Auto-save do quiz (DB como fonte de verdade, sessionStorage é cache de UI)
ALTER TABLE generation_sessions ADD COLUMN draft_answers jsonb NOT NULL DEFAULT '{}';

-- 3. Índice parcial para jobs de limpeza de sessões abandonadas
--    Filtro lead_id IS NULL reduz o conjunto varrido ao exato alvo do job.
--    Query típica: WHERE lead_id IS NULL AND updated_at < now() - interval '24h'
CREATE INDEX idx_gen_sessions_abandoned
  ON generation_sessions(updated_at)
  WHERE lead_id IS NULL;

-- 4. RPC atômica do step 12 (idempotência → leads → consent → session update)
CREATE OR REPLACE FUNCTION submit_quiz_step12_atomic(
  p_session_id     uuid,
  p_ip             inet,
  p_country        country_code,
  p_policy_version text,
  p_consent_text   text,
  p_email          citext,
  p_name           text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lead_id uuid;
BEGIN
  -- 0. idempotência: se a sessão já tem lead_id vinculado, retornar sem re-inserir.
  --    Previne leads órfãos em double-submit (botão clicado duas vezes, retry de rede).
  SELECT lead_id INTO v_lead_id
    FROM generation_sessions
    WHERE id = p_session_id;

  IF v_lead_id IS NOT NULL THEN
    RETURN v_lead_id;
  END IF;

  -- 1. inserir lead primeiro (necessário para constraint chk_consent_subject_ref)
  INSERT INTO leads (email, name, country)
    VALUES (p_email, p_name, p_country)
    RETURNING id INTO v_lead_id;

  -- 2. inserir consent com lead_id (satisfaz chk_consent_subject_ref)
  INSERT INTO consent_records
    (subject_kind, lead_id, policy_version, consent_text, ip_address, country)
  VALUES
    ('lead', v_lead_id, p_policy_version, p_consent_text, p_ip, p_country);

  -- 3. vincular lead à sessão; validar que step 7 foi concluído (country IS NOT NULL)
  UPDATE generation_sessions
    SET lead_id    = v_lead_id,
        updated_at = now()
    WHERE id = p_session_id
      AND country IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_invalid_or_country_missing: %', p_session_id;
  END IF;

  RETURN v_lead_id;
END;
$$;

-- 5. Helper para merge atômico do draft (evita read-then-write no application layer)
--    Operador || faz shallow merge: cada step é chave separada.
--    country atualizado apenas quando p_country IS NOT NULL (steps 1-6 não enviam).
CREATE OR REPLACE FUNCTION save_quiz_draft_step(
  p_session_id uuid,
  p_step       int,
  p_answers    jsonb,
  p_country    country_code DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE generation_sessions
    SET draft_answers = draft_answers || jsonb_build_object('step_' || p_step, p_answers),
        country       = COALESCE(p_country, country),
        updated_at    = now()
    WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found: %', p_session_id;
  END IF;
END;
$$;

-- =============================================================================
-- FIM 0013_draft_answers_country_nullable
-- =============================================================================
