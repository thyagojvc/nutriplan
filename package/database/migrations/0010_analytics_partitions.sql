-- =============================================================================
-- NUTRIPLAN — MIGRATION 0010_analytics_partitions
-- Base: Spec Tecnica Fase 1 + Adendos v1.1, v1.2, v1.3 (T7)
-- Escopo: analytics_events particionada por mes.
-- Ordem canonica (v1.2 T1): etapa 23.
-- Depende de: 0001 (country_code).
--
-- CONFIRMACOES desta migration:
--  1. PK composta incluindo created_at (exigencia de tabela particionada).
--  2. Particao DEFAULT (nao quebra insercao ao virar o mes).
--  3. Indices nas particoes (herdados da tabela-mae particionada).
--  4. Caminhos de consulta principais: event_name e created_at.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- analytics_events (particionada por range de created_at)
-- -----------------------------------------------------------------------------
create table analytics_events (
  id          uuid not null default gen_random_uuid(),
  event_name  text not null,
  session_id  uuid,
  lead_id     uuid,
  user_id     uuid,
  order_id    uuid,
  country     country_code,
  properties  jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  -- (1) PK composta com a coluna de particionamento
  primary key (id, created_at)
) partition by range (created_at);

-- (2) particao DEFAULT obrigatoria: captura qualquer data sem particao especifica
create table analytics_events_default partition of analytics_events default;

-- particao do mes corrente (rotina administrativa cria os meses seguintes)
create table analytics_events_2026_06 partition of analytics_events
  for values from ('2026-06-01') to ('2026-07-01');

-- (3)(4) indices na tabela-mae (propagados as particoes)
create index idx_analytics_event_name on analytics_events(event_name);
create index idx_analytics_created on analytics_events(created_at);
create index idx_analytics_event_time on analytics_events(event_name, created_at);

comment on table analytics_events is 'Eventos de analytics particionados por mes (T7). PK composta com created_at; particao default evita falha ao virar o mes. Consulta principal por event_name e created_at.';

-- -----------------------------------------------------------------------------
-- Funcao utilitaria: criar particao de um mes (idempotente).
-- Chamada por rotina administrativa antes da virada de mes.
-- -----------------------------------------------------------------------------
create or replace function create_analytics_partition(p_year int, p_month int)
returns void language plpgsql as $$
declare
  start_date date := make_date(p_year, p_month, 1);
  end_date   date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  part_name  text := format('analytics_events_%s_%s', p_year, lpad(p_month::text, 2, '0'));
begin
  if not exists (select 1 from pg_class where relname = part_name) then
    execute format(
      'create table %I partition of analytics_events for values from (%L) to (%L)',
      part_name, start_date, end_date
    );
  end if;
end $$;

-- =============================================================================
-- FIM 0010_analytics_partitions
-- =============================================================================
