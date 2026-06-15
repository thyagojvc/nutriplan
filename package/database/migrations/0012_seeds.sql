-- =============================================================================
-- NUTRIPLAN — MIGRATION 0012_seeds
-- Base: Spec Tecnica Fase 1 + Adendos v1.1, v1.2, v1.3
-- Escopo: seeds finais NAO sensiveis e particoes iniciais de analytics.
-- Ordem canonica (v1.2 T1): etapa 26 (seeds).
-- Depende de: 0001 a 0011.
--
-- O QUE NAO E SEMEADO AQUI (decisoes ja tomadas):
--  - admin_users: NENHUM admin criado por migration. Primeiro superadmin
--    provisionado manualmente apos criar usuario no Supabase Auth com MFA.
--  - price_book: valores locais inseridos por operacao administrativa antes da
--    Fase 5 (nao seed; exige created_by_admin_id de um admin real).
--  - products: ja semeado em 0002 (PLAN_STANDARD, TRAINING_BUMP).
--  - feature_flags: ja semeado em 0008 (3 flags operacionais).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Particoes de analytics dos proximos meses (evita depender so da default).
-- A rotina administrativa deve manter a criacao mensal continua.
-- -----------------------------------------------------------------------------
select create_analytics_partition(2026, 7);
select create_analytics_partition(2026, 8);
select create_analytics_partition(2026, 9);

-- -----------------------------------------------------------------------------
-- Verificacao de seeds existentes (idempotente; nao recria).
-- Garante que os produtos base existem antes da Fase 5.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from products where code = 'PLAN_STANDARD') then
    raise exception 'Seed ausente: products.PLAN_STANDARD (verifique a 0002)';
  end if;
  if not exists (select 1 from products where code = 'TRAINING_BUMP') then
    raise exception 'Seed ausente: products.TRAINING_BUMP (verifique a 0002)';
  end if;
end $$;

-- =============================================================================
-- CHECKLIST DE PROVISIONAMENTO MANUAL (fora das migrations, antes do go-live):
--  [ ] Criar primeiro superadmin no Supabase Auth (MFA) e inserir em admin_users
--      via service_role.
--  [ ] Preencher price_book com os precos locais vigentes de MX, CO, CL, ES
--      (PLAN_STANDARD e TRAINING_BUMP), com created_by_admin_id do superadmin.
--  [ ] Configurar buckets privados de Storage por usuario para PDFs.
--  [ ] Configurar chaves Stripe e Mercado Pago e os webhooks.
--  [ ] Publicar Politica de Privacidade e Termos (A4) e registrar policy_version.
-- =============================================================================
-- FIM 0012_seeds
-- =============================================================================
