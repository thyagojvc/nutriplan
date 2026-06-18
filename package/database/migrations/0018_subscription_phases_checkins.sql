-- =============================================================================
-- NUTRIPLAN — MIGRATION 0018_subscription_phases_checkins
-- Escopo: suporte a assinatura recorrente com fases progressivas (mês 1/2/3)
--   1. subscription_cycle em orders (qual ciclo de cobrança originou o pedido)
--   2. phase_number em nutrition_plans (qual das 3 fases o plano representa)
--   3. user_checkins (check-in mensal do assinante antes de gerar novo plano)
--   4. checkin_reminder no enum email_type
-- Depende de: 0001 (enums), 0003 (users), 0005 (orders), 0006 (nutrition_plans).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. subscription_cycle em orders
--    1 = primeira compra, 2 = 1ª renovação, 3 = 2ª renovação, etc.
-- -----------------------------------------------------------------------------
alter table orders
  add column if not exists subscription_cycle integer not null default 1
    check (subscription_cycle >= 1);

comment on column orders.subscription_cycle is
  'Ciclo de cobrança Hotmart: 1=primeira compra, 2=primeira renovação, etc.';

-- -----------------------------------------------------------------------------
-- 2. phase_number em nutrition_plans
--    Derivado de subscription_cycle: 1→Adaptação, 2→Aceleração, 3→Consolidação
-- -----------------------------------------------------------------------------
alter table nutrition_plans
  add column if not exists phase_number integer not null default 1
    check (phase_number between 1 and 3);

comment on column nutrition_plans.phase_number is
  'Fase do plano progressivo: 1=Adaptação, 2=Aceleração, 3=Consolidação/Manutenção.';

-- -----------------------------------------------------------------------------
-- 3. user_checkins — check-in mensal do assinante
--    Criado pelo webhook de renovação; completado pelo usuário antes de gerar
--    o plano da fase seguinte.
-- -----------------------------------------------------------------------------
create table user_checkins (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id),
  order_id           uuid not null references orders(id),
  cycle_number       integer not null check (cycle_number between 1 and 3),
  token              text unique not null,
  current_weight_kg  numeric(5, 2),
  adherence_rating   integer check (adherence_rating between 1 and 5),
  notes              text,
  completed_at       timestamptz,
  created_at         timestamptz not null default now()
);

create index idx_checkins_user    on user_checkins(user_id);
create index idx_checkins_order   on user_checkins(order_id);
create index idx_checkins_token   on user_checkins(token);

-- Único check-in por ciclo por usuário (evita duplicação em re-envio do webhook)
create unique index uq_checkin_user_cycle
  on user_checkins(user_id, cycle_number);

comment on table user_checkins is
  'Check-in mensal pré-geração. Token de URL único por ciclo. Completado pelo usuário; dispara processPaidOrder() na fase correspondente.';

-- -----------------------------------------------------------------------------
-- 4. checkin_reminder no enum email_type
--    ALTER TYPE ADD VALUE é transacional no Postgres 12+; não requer commit separado.
-- -----------------------------------------------------------------------------
alter type email_type add value if not exists 'checkin_reminder';
