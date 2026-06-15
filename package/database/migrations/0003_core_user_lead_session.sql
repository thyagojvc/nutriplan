-- =============================================================================
-- NUTRIPLAN — MIGRATION 0003_core_user_lead_session
-- Base: Spec Tecnica Fase 1 + Adendos v1.1, v1.2, v1.3
-- Escopo: tabelas users, leads, generation_sessions.
-- Ordem canonica (v1.2 T1): etapas 5 (users), 6 (leads), 7 (generation_sessions).
-- Depende de: 0001 (country_code), 0002 (nenhuma FK; ordem apenas).
--
-- CONFIRMACOES desta migration:
--  - users.email e users.auth_user_id com constraints UNICAS NOMEADAS.
--  - users.email citext, suporta upsert idempotente por e-mail (T9) em 0009/app.
--  - users.auth_user_id sem FK direta para auth.users (vinculo logico).
--  - generation_sessions e entidade de VINCULO, SEM coluna de estado proprio.
--    O ciclo de vida vive em order_status (decisao da 0001).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
create table users (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid,                              -- vinculo logico a auth.users (sem FK direta)
  email        citext not null,
  name         text not null,
  country      country_code,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Constraints unicas NOMEADAS (pedido explicito)
alter table users add constraint uq_users_email unique (email);
alter table users add constraint uq_users_auth_user_id unique (auth_user_id);

comment on table users is 'Clientes pagantes. Conta criada pelo backend no webhook (caminho B). email unico suporta upsert idempotente (T9).';
comment on column users.auth_user_id is 'UUID no Supabase Auth. Vinculo logico, sem FK direta para auth.users.';

create index idx_users_auth_user_id on users(auth_user_id);

-- -----------------------------------------------------------------------------
-- leads
-- Sem unique em email: multiplos leads do mesmo e-mail sao esperados (T9).
-- A unicidade de identidade vive em users.email.
-- -----------------------------------------------------------------------------
create table leads (
  id         uuid primary key default gen_random_uuid(),
  email      citext not null,
  name       text not null,
  country    country_code not null,
  user_id    uuid references users(id) on delete set null,
  converted  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table leads is 'Leads capturados no funil. Sem unique em email (multiplos leads por e-mail sao esperados).';

create index idx_leads_email on leads(email);
create index idx_leads_converted on leads(converted);
create index idx_leads_user on leads(user_id);

-- -----------------------------------------------------------------------------
-- generation_sessions
-- Entidade de VINCULO entre lead, usuario, questionario, previa e pedido.
-- SEM coluna de estado proprio: o ciclo de vida vive em order_status (0001).
-- -----------------------------------------------------------------------------
create table generation_sessions (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid references leads(id) on delete set null,
  user_id    uuid references users(id) on delete set null,
  country    country_code not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table generation_sessions is 'Entidade de vinculo (lead, usuario, questionario, previa, pedido). Sem estado proprio; o ciclo de vida vive em order_status.';

create index idx_gen_sessions_lead on generation_sessions(lead_id);
create index idx_gen_sessions_user on generation_sessions(user_id);

-- =============================================================================
-- FIM 0003_core_user_lead_session
-- =============================================================================
