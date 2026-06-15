-- =============================================================================
-- NUTRIPLAN — MIGRATION 0006_plans_documents
-- Base: Spec Tecnica Fase 1 + Adendos v1.1, v1.2, v1.3
-- Escopo: nutrition_plans, training_plans, generated_documents.
-- Ordem canonica (v1.2 T1): etapas 12, 13, 14.
-- Depende de: 0001 (enums), 0003 (users, generation_sessions), 0005 (orders).
--
-- REGRAS EXPLICITAS desta migration:
--  1. nutrition_plans e training_plans: UNIQUE(order_id) (cardinalidade no banco,
--     alem da protecao de concorrencia do T6 na aplicacao).
--  2. generated_documents: persiste storage_path/file_name/checksum (bucket
--     privado; URLs de download sao assinadas e temporarias, geradas sob demanda,
--     nao persistidas). Esses campos sao IMUTAVEIS por linha.
--  3. Reprocessamento pos revisao manual SUBSTITUI o documento (opcao A, sem
--     versionar). A substituicao e feita por DELETE + INSERT (recria a linha),
--     preservando a imutabilidade dos campos por linha e mantendo unique(order_id, kind).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- nutrition_plans (sempre gerado pos-pagamento)
-- -----------------------------------------------------------------------------
create table nutrition_plans (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders(id) on delete cascade,
  user_id          uuid not null references users(id) on delete cascade,
  session_id       uuid references generation_sessions(id) on delete set null,
  cycle_days       int not null default 7,
  cycle_weeks      int not null default 4,
  clinical_flags   health_condition[] not null default '{none}',
  general_guidance boolean not null default false,   -- diabetes/outra => true
  plan_json        jsonb not null,                   -- 7 dias, refeicoes, substituicoes, lista de compras, guia
  model_used       text,
  prompt_version   text,
  created_at       timestamptz not null default now()
);

-- (1) cardinalidade: no maximo 1 plano nutricional por pedido
alter table nutrition_plans add constraint uq_nutrition_plan_order unique (order_id);

create index idx_nutrition_plans_user on nutrition_plans(user_id);

comment on table nutrition_plans is 'Plano nutricional completo (pos-pagamento). 1 por pedido. plan_json e fonte de verdade do conteudo.';

-- -----------------------------------------------------------------------------
-- training_plans (condicional: apenas se houver item de treino no pedido)
-- -----------------------------------------------------------------------------
create table training_plans (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  session_id     uuid references generation_sessions(id) on delete set null,
  clinical_flags health_condition[] not null default '{none}',
  limitations    physical_limitation[] not null default '{none}',
  plan_json      jsonb not null,
  model_used     text,
  prompt_version text,
  created_at     timestamptz not null default now()
);

-- (1) cardinalidade: no maximo 1 plano de treino por pedido
alter table training_plans add constraint uq_training_plan_order unique (order_id);

create index idx_training_plans_user on training_plans(user_id);

comment on table training_plans is 'Plano de treino (pos-pagamento, condicional ao order bump). 1 por pedido.';

-- -----------------------------------------------------------------------------
-- generated_documents
-- storage_path em bucket privado; download via URL assinada temporaria (nao persistida).
-- -----------------------------------------------------------------------------
create table generated_documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  order_id     uuid not null references orders(id) on delete cascade,
  kind         document_kind not null,
  storage_path text not null,                   -- imutavel por linha
  file_name    text not null,                   -- imutavel por linha
  checksum     text not null,                   -- imutavel por linha (hash do arquivo entregue)
  created_at   timestamptz not null default now()
);

-- (3) T6: barreira contra documento duplicado por pedido e tipo
alter table generated_documents add constraint uq_doc_order_kind unique (order_id, kind);

create index idx_docs_user on generated_documents(user_id);

comment on table generated_documents is 'Documentos PDF complementares (Decisao 16). storage_path/file_name/checksum imutaveis por linha. Reprocessamento substitui via DELETE+INSERT (opcao A, sem versionar).';

-- (2) imutabilidade dos campos do documento por linha.
-- A substituicao no reprocessamento e feita por DELETE+INSERT (recria a linha),
-- nunca por UPDATE destes campos.
create or replace function guard_generated_documents_immutable()
returns trigger language plpgsql as $$
begin
  if new.storage_path is distinct from old.storage_path
     or new.file_name is distinct from old.file_name
     or new.checksum is distinct from old.checksum
     or new.kind is distinct from old.kind
     or new.order_id is distinct from old.order_id then
    raise exception 'campos de generated_documents sao imutaveis; substitua via DELETE+INSERT no reprocessamento';
  end if;
  return new;
end $$;

create trigger trg_generated_documents_immutable
  before update on generated_documents
  for each row execute function guard_generated_documents_immutable();

-- =============================================================================
-- FIM 0006_plans_documents
-- =============================================================================
