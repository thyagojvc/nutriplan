-- =============================================================================
-- NUTRIPLAN — MIGRATION 0008_webhook_feature_flags
-- Base: Spec Tecnica Fase 1 + Adendos v1.1, v1.2, v1.3
-- Escopo: webhook_logs (T3, v1.1, v1.3 P4) e feature_flags (v1.1, v1.3 P3).
-- Ordem canonica (v1.2 T1): etapas 16 (webhook_logs) e 17 (feature_flags).
-- Depende de: 0001 (payment_provider), 0002 (admin_users), 0005 (orders).
--
-- CONFIRMACOES desta migration:
--  webhook_logs:
--   - provider_event_id NOT NULL
--   - retry_count NOT NULL DEFAULT 0
--   - unique (provider, provider_event_id) para deduplicacao real
--   - indice para processed=false (consulta do worker de retry)
--  feature_flags:
--   - tabela minima (key PK, enabled, description, created_at). Sem painel,
--     sem versionamento, sem rollout percentual.
--  helper:
--   - is_feature_enabled(text): stable, security definer, search_path=public.
--  seeds:
--   - apenas 3 flags operacionais.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- webhook_logs (T3): payload bruto + rastreio de processamento e retry
-- -----------------------------------------------------------------------------
create table webhook_logs (
  id                  uuid primary key default gen_random_uuid(),
  provider            payment_provider not null,
  provider_event_id   text not null,                       -- NOT NULL
  provider_payment_id text,
  event_type          text,
  payload_json        jsonb not null,
  signature_valid     boolean not null default false,
  processed           boolean not null default false,
  processed_at        timestamptz,
  retry_count         int not null default 0,              -- NOT NULL DEFAULT 0
  order_id            uuid references orders(id) on delete set null,
  error_detail        text,
  created_at          timestamptz not null default now()
);

-- deduplicacao real por evento do provider
alter table webhook_logs add constraint uq_webhook_event unique (provider, provider_event_id);

-- consulta do worker de retry: eventos ainda nao processados
create index idx_webhook_unprocessed on webhook_logs(created_at) where processed = false;
create index idx_webhook_payment on webhook_logs(provider_payment_id);

comment on table webhook_logs is 'Payload bruto de webhooks de pagamento (T3). Dedup por (provider, provider_event_id). retry_count suporta reprocessamento; payload nunca e apagado.';

-- -----------------------------------------------------------------------------
-- feature_flags (minima)
-- -----------------------------------------------------------------------------
create table feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  updated_by  uuid references admin_users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

comment on table feature_flags is 'Flags minimas para ligar/desligar funcionalidades ja especificadas na v8, sem deploy. Sem painel, versionamento ou rollout percentual.';

-- helper de consulta (igual aos helpers de RLS do v1.2)
create or replace function is_feature_enabled(flag_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from feature_flags where key = flag_name), false)
$$;

-- seeds: apenas flags operacionais
insert into feature_flags (key, enabled, description) values
  ('training_bump_enabled', true,  'Habilita o order bump de treino no paywall e checkout'),
  ('cart_recovery_enabled', true,  'Habilita a sequencia de recuperacao de carrinho (1h/24h/72h)'),
  ('email_nurture_enabled', true,  'Habilita a sequencia pos-compra (D0/D2/D5/D10/D20)');

-- =============================================================================
-- FIM 0008_webhook_feature_flags
-- =============================================================================
