-- =============================================================================
-- NUTRIPLAN — MIGRATION 0009_consent_email_upsell_review_audit
-- Base: Spec Tecnica Fase 1 + Adendos v1.1, v1.2, v1.3
-- Escopo: consent_records (F3), email_logs (T4), user_upsells,
--         manual_review_queue (F7), admin_audit_log (A5).
-- Ordem canonica (v1.2 T1): etapas 18, 19, 20, 21, 22.
-- Depende de: 0001 (enums), 0002 (admin_users), 0003 (users, leads), 0005 (orders).
--
-- CONFIRMACOES desta migration:
--  1. consent_records: append-only (trigger bloqueia UPDATE/DELETE). RLS na 0011.
--  2. admin_audit_log: append-only (trigger bloqueia UPDATE/DELETE).
--  3. manual_review_queue: unique(order_id) (uma revisao aberta por pedido).
--  4. email_logs: indice parcial para status='queued' (worker de envio) + T4.
--  5. user_upsells: registra apenas compra. Exibicao vai para analytics_events.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- consent_records (F3) — append-only
-- -----------------------------------------------------------------------------
create table consent_records (
  id             uuid primary key default gen_random_uuid(),
  subject_kind   consent_subject not null,
  lead_id        uuid references leads(id) on delete set null,
  user_id        uuid references users(id) on delete set null,
  policy_version text not null,
  consent_text   text not null,
  ip_address     inet not null,
  country        country_code not null,
  consented_at   timestamptz not null default now()
);
alter table consent_records add constraint chk_consent_subject_ref check (
  (subject_kind = 'lead' and lead_id is not null and user_id is null)
  or
  (subject_kind = 'user' and user_id is not null)
);

create index idx_consent_lead on consent_records(lead_id);
create index idx_consent_user on consent_records(user_id);

comment on table consent_records is 'Consentimento LGPD/GDPR (F3). Append-only: novos consentimentos geram novas linhas. Sem UPDATE/DELETE.';

create or replace function block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'tabela append-only: % nao permitido', tg_op;
end $$;

create trigger trg_consent_append_only
  before update or delete on consent_records
  for each row execute function block_mutation();

-- -----------------------------------------------------------------------------
-- email_logs (T4) — dois indices parciais de unicidade + fila
-- -----------------------------------------------------------------------------
create table email_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete set null,
  lead_id         uuid references leads(id) on delete set null,
  order_id        uuid references orders(id) on delete set null,
  email_type      email_type not null,
  status          email_status not null default 'queued',
  provider_msg_id text,
  scheduled_for   timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- T4: deduplicacao por dominio
create unique index uq_email_post_purchase
  on email_logs(order_id, email_type)
  where order_id is not null;
create unique index uq_email_cart_recovery
  on email_logs(lead_id, email_type)
  where lead_id is not null and order_id is null;

-- (4) fila do worker de envio
create index idx_email_queue on email_logs(created_at) where status = 'queued';
create index idx_email_logs_order on email_logs(order_id);

comment on table email_logs is 'Log de e-mails. Sequencia pos-compra deduplicada por pedido; recuperacao de carrinho por lead (T4). Indice de fila para status queued.';

-- -----------------------------------------------------------------------------
-- user_upsells — registra apenas compra
-- -----------------------------------------------------------------------------
create table user_upsells (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  order_id     uuid not null references orders(id) on delete cascade,
  product_code product_code not null,
  created_at   timestamptz not null default now()
);
alter table user_upsells add constraint fk_upsell_product
  foreign key (product_code) references products(code) on update cascade;
create index idx_user_upsells_user on user_upsells(user_id);

comment on table user_upsells is 'Upsells COMPRADOS por usuario. Exibicao de oferta vai para analytics_events, nao aqui.';

-- -----------------------------------------------------------------------------
-- manual_review_queue (F7) — unique(order_id)
-- -----------------------------------------------------------------------------
create table manual_review_queue (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  plan_kind      plan_kind not null,
  reason         review_reason not null,
  status         review_status not null default 'open',
  attempts       int not null default 0,
  review_count   int not null default 1,    -- nº de vezes que o pedido entrou em revisao
  details        jsonb not null default '{}',
  assigned_admin uuid references admin_users(id) on delete set null,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);

-- (3) uma revisao por pedido (historico de idas e voltas fica no audit log)
alter table manual_review_queue add constraint uq_review_order unique (order_id);

create index idx_review_status on manual_review_queue(status);

comment on table manual_review_queue is 'Fila de revisao manual (F7). Uma linha por pedido (unique). Reprocessos registrados em admin_audit_log.';

-- -----------------------------------------------------------------------------
-- admin_audit_log (A5) — append-only
-- -----------------------------------------------------------------------------
create table admin_audit_log (
  id              uuid primary key default gen_random_uuid(),
  actor_admin_id  uuid references admin_users(id) on delete set null,
  action          text not null,                  -- ex.: 'price_book.publish', 'order.reprocess', 'user_data.view'
  entity_type     text,
  entity_id       uuid,
  ip_address      inet,
  payload_json    jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index idx_audit_actor on admin_audit_log(actor_admin_id);
create index idx_audit_action on admin_audit_log(action);
create index idx_audit_created on admin_audit_log(created_at);

comment on table admin_audit_log is 'Trilha de auditoria administrativa (A5). Append-only: sem UPDATE/DELETE. Grava leitura de dados de usuario e reprocessamentos.';

create trigger trg_audit_append_only
  before update or delete on admin_audit_log
  for each row execute function block_mutation();

-- =============================================================================
-- FIM 0009_consent_email_upsell_review_audit
-- =============================================================================
