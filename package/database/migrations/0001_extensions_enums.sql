-- =============================================================================
-- NUTRIPLAN — MIGRATION 0001_extensions_enums (revisada)
-- Base: Spec Tecnica Fase 1 + Adendos v1.1, v1.2, v1.3
-- Escopo: extensoes necessarias e todos os enums da Fase 1.
-- Ordem canonica (v1.2 T1): etapa 1 (extensoes) e etapa 2 (enums).
--
-- REVISAO desta versao:
--  - Removido o enum generation_status. O ciclo de vida e a entrega passam a
--    ser fonte unica em order_status (processing->generating,
--    manual_review->needs_review, completed->delivered, queued = intervalo
--    paid->generating). generation_sessions nao tera coluna de status proprio
--    (ver 0003); o estado vive no pedido vinculado.
--  - create type puro mantido como padrao de producao. Bloco opcional de reset
--    para desenvolvimento incluido comentado abaixo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. (OPCIONAL, SOMENTE DESENVOLVIMENTO) RESET DE TIPOS
-- Descomentar apenas em ambiente local para permitir reaplicar a migration.
-- NAO usar em producao.
-- -----------------------------------------------------------------------------
-- do $$
-- begin
--   drop type if exists
--     country_code, currency_code, sex_biological, goal_type, activity_level,
--     health_condition, physical_limitation, training_experience, training_location,
--     product_code, order_status, payment_provider, order_item_kind, plan_kind,
--     document_kind, email_type, email_status, admin_role, review_reason,
--     review_status, consent_subject, price_status
--   cascade;
-- end $$;

-- -----------------------------------------------------------------------------
-- 1. EXTENSOES
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";      -- e-mails case-insensitive

-- -----------------------------------------------------------------------------
-- 2. ENUMS
-- -----------------------------------------------------------------------------

-- Geografia e moeda (MVP: MX, CO, CL, ES)
create type country_code as enum ('MX','CO','CL','ES');
create type currency_code as enum ('MXN','COP','CLP','EUR');

-- Questionario: dados estruturados
create type sex_biological as enum ('female','male');
create type goal_type as enum ('lose_fat','gain_muscle','maintain','health_energy');
create type activity_level as enum ('sedentary','light','regular','very_active');

-- Saude (F2) e limitacoes musculoesqueleticas (Decisao 6)
create type health_condition as enum ('none','pregnant','hypertension','heart_disease','diabetes','other');
create type physical_limitation as enum ('none','knee','lower_back','shoulder','wrist_elbow','varicose','other');

-- Treino
create type training_experience as enum ('beginner','intermediate','advanced');
create type training_location as enum ('gym','home_equipped','home_no_equipment','outdoor');

-- Produtos
create type product_code as enum ('PLAN_STANDARD','TRAINING_BUMP','RECIPES_PACK','SHOPPING_LIST_PREMIUM','PLAN_UPDATE');

-- Pedidos e pagamento
-- order_status: fonte unica do ciclo de vida e entrega (v1.3 P2).
-- Absorve o antigo generation_status (removido nesta revisao).
create type order_status as enum ('pending','paid','generating','needs_review','delivered','failed','refunded');
create type payment_provider as enum ('stripe','mercado_pago');
create type order_item_kind as enum ('nutrition','training','upsell');

-- Planos (kind dos planos gerados; nao confundir com status)
create type plan_kind as enum ('nutrition','training');

-- Documentos
create type document_kind as enum ('nutrition_plan','implementation_guide','training_plan');

-- E-mails
create type email_type as enum (
  'delivery_d0','implementation_d2','common_errors_d5','social_proof_d10','renewal_d20',
  'cart_recovery_1h','cart_recovery_24h','cart_recovery_72h'
);
create type email_status as enum ('queued','sent','failed','skipped');

-- Administracao (A5)
create type admin_role as enum ('superadmin','operator','support','read_only');

-- Fila de revisao manual (F7)
create type review_reason as enum ('restriction_unresolved','generation_failed','validation_failed');
create type review_status as enum ('open','in_progress','resolved','discarded');

-- Consentimento (F3)
create type consent_subject as enum ('lead','user');

-- price_book: status apenas workflow (v1.1; semantica fixada no v1.3 P1).
-- A vigencia e resolvida por effective_from/effective_to, nao por este status.
create type price_status as enum ('draft','active','retired');

-- =============================================================================
-- FIM 0001_extensions_enums (revisada)
-- =============================================================================
