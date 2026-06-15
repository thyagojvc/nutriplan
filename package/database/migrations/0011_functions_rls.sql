-- =============================================================================
-- NUTRIPLAN — MIGRATION 0011_functions_rls
-- Base: Spec Tecnica Fase 1 + Adendos v1.1, v1.2, v1.3
-- Escopo: funcoes helper + habilitacao de RLS + politicas por tabela.
-- Ordem canonica (v1.2 T1): etapas 24 (helpers) e 25 (RLS).
-- Depende de: todas as tabelas (0002 a 0010).
--
-- PRINCIPIOS:
--  - Escrita de sistema via service_role (bypass nativo do Supabase). Nao ha
--    policy de INSERT/UPDATE/DELETE para roles autenticadas nas tabelas de
--    sistema; o bypass do service_role cobre isso.
--  - SELECT do usuario final apenas nas proprias linhas (current_app_user_id()).
--  - SELECT administrativo SEGMENTADO por papel (has_admin_role), nao amplo.
--  - FORCE ROW LEVEL SECURITY em todas as tabelas com RLS.
--  - consent_records e admin_audit_log: sem UPDATE/DELETE (append-only);
--    triggers da 0009 como segunda barreira.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- HELPERS (security definer, search_path fixo) — T5
-- -----------------------------------------------------------------------------
create or replace function current_app_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from users where auth_user_id = auth.uid() limit 1
$$;

create or replace function is_active_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users a
    where a.auth_user_id = auth.uid() and a.active
  )
$$;

-- has_admin_role: superadmin satisfaz qualquer papel exigido; demais satisfazem
-- apenas o proprio papel. Requer admin ativo.
create or replace function has_admin_role(role_name admin_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users a
    where a.auth_user_id = auth.uid()
      and a.active
      and (a.role = 'superadmin' or a.role = role_name)
  )
$$;

-- =============================================================================
-- HABILITACAO E FORCE RLS
-- =============================================================================
alter table users                enable row level security;
alter table users                force  row level security;
alter table leads                enable row level security;
alter table leads                force  row level security;
alter table generation_sessions  enable row level security;
alter table generation_sessions  force  row level security;
alter table questionnaire_answers enable row level security;
alter table questionnaire_answers force row level security;
alter table previews             enable row level security;
alter table previews             force  row level security;
alter table products             enable row level security;
alter table products             force  row level security;
alter table price_book           enable row level security;
alter table price_book           force  row level security;
alter table orders               enable row level security;
alter table orders               force  row level security;
alter table order_items          enable row level security;
alter table order_items          force  row level security;
alter table nutrition_plans      enable row level security;
alter table nutrition_plans      force  row level security;
alter table training_plans       enable row level security;
alter table training_plans       force  row level security;
alter table generated_documents  enable row level security;
alter table generated_documents  force  row level security;
alter table email_logs           enable row level security;
alter table email_logs           force  row level security;
alter table analytics_events     enable row level security;
alter table analytics_events     force  row level security;
alter table user_upsells         enable row level security;
alter table user_upsells         force  row level security;
alter table consent_records      enable row level security;
alter table consent_records      force  row level security;
alter table manual_review_queue  enable row level security;
alter table manual_review_queue  force  row level security;
alter table webhook_logs         enable row level security;
alter table webhook_logs         force  row level security;
alter table feature_flags        enable row level security;
alter table feature_flags        force  row level security;
alter table admin_users          enable row level security;
alter table admin_users          force  row level security;
alter table admin_audit_log      enable row level security;
alter table admin_audit_log      force  row level security;

-- =============================================================================
-- POLITICAS — TABELAS DO USUARIO FINAL
-- Regra geral: SELECT do dono; sem INSERT/UPDATE/DELETE (escrita via service_role).
-- Acesso administrativo de leitura segmentado por papel.
-- =============================================================================

-- users -----------------------------------------------------------------------
-- dono ve a si mesmo; support+ pode ver (suporte ao cliente)
create policy users_select_self on users
  for select using (auth_user_id = auth.uid());
create policy users_select_admin on users
  for select using (has_admin_role('support') or has_admin_role('operator') or has_admin_role('read_only') or has_admin_role('superadmin'));
-- Atualizacao de perfil NAO ocorre via RLS (RLS e por linha, nao por coluna).
-- Alteracoes de perfil passam por endpoint backend e sao aplicadas via service_role.

-- leads (operacional/marketing) -----------------------------------------------
create policy leads_select_admin on leads
  for select using (has_admin_role('operator') or has_admin_role('read_only') or has_admin_role('superadmin'));

-- generation_sessions ---------------------------------------------------------
create policy gs_select_owner on generation_sessions
  for select using (user_id = current_app_user_id());
create policy gs_select_admin on generation_sessions
  for select using (has_admin_role('operator') or has_admin_role('read_only') or has_admin_role('superadmin'));

-- questionnaire_answers (dado sensivel de saude) ------------------------------
-- dono via sessao; admin apenas operator+ (acesso registrado em audit log pela app)
create policy qa_select_owner on questionnaire_answers
  for select using (
    session_id in (select id from generation_sessions where user_id = current_app_user_id())
  );
create policy qa_select_admin on questionnaire_answers
  for select using (has_admin_role('operator') or has_admin_role('superadmin'));

-- previews --------------------------------------------------------------------
create policy previews_select_owner on previews
  for select using (
    session_id in (select id from generation_sessions where user_id = current_app_user_id())
  );
create policy previews_select_admin on previews
  for select using (has_admin_role('operator') or has_admin_role('read_only') or has_admin_role('superadmin'));

-- orders ----------------------------------------------------------------------
create policy orders_select_owner on orders
  for select using (user_id = current_app_user_id());
create policy orders_select_admin on orders
  for select using (has_admin_role('support') or has_admin_role('operator') or has_admin_role('read_only') or has_admin_role('superadmin'));

-- order_items -----------------------------------------------------------------
create policy oi_select_owner on order_items
  for select using (
    order_id in (select id from orders where user_id = current_app_user_id())
  );
create policy oi_select_admin on order_items
  for select using (has_admin_role('support') or has_admin_role('operator') or has_admin_role('read_only') or has_admin_role('superadmin'));

-- nutrition_plans -------------------------------------------------------------
create policy np_select_owner on nutrition_plans
  for select using (user_id = current_app_user_id());
create policy np_select_admin on nutrition_plans
  for select using (has_admin_role('operator') or has_admin_role('superadmin'));

-- training_plans --------------------------------------------------------------
create policy tp_select_owner on training_plans
  for select using (user_id = current_app_user_id());
create policy tp_select_admin on training_plans
  for select using (has_admin_role('operator') or has_admin_role('superadmin'));

-- generated_documents ---------------------------------------------------------
create policy gd_select_owner on generated_documents
  for select using (user_id = current_app_user_id());
create policy gd_select_admin on generated_documents
  for select using (has_admin_role('support') or has_admin_role('operator') or has_admin_role('superadmin'));

-- email_logs (operacional) ----------------------------------------------------
create policy email_select_admin on email_logs
  for select using (has_admin_role('operator') or has_admin_role('read_only') or has_admin_role('superadmin'));

-- user_upsells ----------------------------------------------------------------
create policy upsell_select_owner on user_upsells
  for select using (user_id = current_app_user_id());
create policy upsell_select_admin on user_upsells
  for select using (has_admin_role('operator') or has_admin_role('read_only') or has_admin_role('superadmin'));

-- =============================================================================
-- POLITICAS — TABELAS ADMINISTRATIVAS / DE SISTEMA
-- SELECT segmentado por papel; escrita via service_role (sem policy).
-- =============================================================================

-- products: catalogo legivel por usuario autenticado (necessario ao paywall) --
create policy products_select_all on products
  for select using (auth.role() = 'authenticated');

-- price_book: leitura por usuario autenticado (preco do paywall) --------------
-- escrita (publicacao) via service_role/aplicacao com gravacao em audit log
create policy price_select_authenticated on price_book
  for select using (auth.role() = 'authenticated');

-- manual_review_queue: operator+ (fila de trabalho) ---------------------------
create policy review_select_admin on manual_review_queue
  for select using (has_admin_role('operator') or has_admin_role('superadmin'));

-- webhook_logs: operator+ (diagnostico de pagamento) --------------------------
create policy webhook_select_admin on webhook_logs
  for select using (has_admin_role('operator') or has_admin_role('superadmin'));

-- feature_flags: leitura admin; escrita via service_role/operator+ na app -----
create policy flags_select_admin on feature_flags
  for select using (has_admin_role('operator') or has_admin_role('read_only') or has_admin_role('superadmin'));

-- analytics_events: operator+ e read_only (BI) --------------------------------
create policy analytics_select_admin on analytics_events
  for select using (has_admin_role('operator') or has_admin_role('read_only') or has_admin_role('superadmin'));

-- admin_users: superadmin gerencia; admin ve a si mesmo -----------------------
create policy admin_users_select_self on admin_users
  for select using (auth_user_id = auth.uid());
create policy admin_users_select_superadmin on admin_users
  for select using (has_admin_role('superadmin'));

-- =============================================================================
-- POLITICAS — TABELAS APPEND-ONLY
-- SELECT: dono ou admin autorizado. INSERT: service_role (sem policy).
-- UPDATE/DELETE: ninguem (sem policy) + trigger block_mutation (0009).
-- =============================================================================

-- consent_records -------------------------------------------------------------
create policy consent_select_owner on consent_records
  for select using (
    (subject_kind = 'user' and user_id = current_app_user_id())
    or has_admin_role('superadmin')
  );
-- sem policy de INSERT (service_role), UPDATE ou DELETE.

-- admin_audit_log -------------------------------------------------------------
create policy audit_select_admin on admin_audit_log
  for select using (has_admin_role('operator') or has_admin_role('superadmin'));
-- INSERT via service_role (sem policy). Sem UPDATE/DELETE. Trigger reforca.

-- =============================================================================
-- NOTA DE OPERACAO
--  - service_role ignora RLS: toda escrita de sistema (webhooks, geracao,
--    e-mails, criacao de pedido, publicacao de preco, reprocessamento) ocorre
--    por ele, fora destas policies.
--  - Acoes administrativas sensiveis (leitura de dados de usuario,
--    reprocessamento, publicacao de preco) gravam admin_audit_log na app
--    antes de executar.
-- =============================================================================
-- FIM 0011_functions_rls
-- =============================================================================

-- =============================================================================
-- ENDURECIMENTO DOS HELPERS (revoke public; grant apenas papeis necessarios)
-- Idempotente. Em Supabase, os papeis authenticated e service_role existem.
-- =============================================================================
do $$
begin
  revoke all on function current_app_user_id() from public;
  revoke all on function is_active_admin() from public;
  revoke all on function has_admin_role(admin_role) from public;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function current_app_user_id() to authenticated;
    grant execute on function is_active_admin() to authenticated;
    grant execute on function has_admin_role(admin_role) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function current_app_user_id() to service_role;
    grant execute on function is_active_admin() to service_role;
    grant execute on function has_admin_role(admin_role) to service_role;
  end if;
end $$;
