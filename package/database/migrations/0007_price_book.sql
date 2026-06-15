-- =============================================================================
-- NUTRIPLAN — MIGRATION 0007_price_book
-- Base: Spec Tecnica Fase 1 + Adendos v1.1, v1.2, v1.3
-- Escopo: price_book (A1-R) - precos locais derivados do preco-base USD.
-- Ordem canonica (v1.2 T1): etapa 15.
-- Depende de: 0001 (enums), 0002 (products.code unique, admin_users).
--
-- REGRAS EXPLICITAS desta migration:
--  A. currency consistente com country (CHECK).
--  B. Sem sobreposicao de periodos por produto/pais (EXCLUDE USING gist + daterange).
--     Mantido tambem o unico de "uma linha aberta" (effective_to is null).
--  C. created_by_admin_id obrigatorio (FK admin_users).
--  D. Linha de preco imutavel apos criacao (trigger); mudanca exige nova linha.
--  Fonte de verdade da vigencia: effective_from/effective_to (v1.3 P1).
--  status e apenas workflow (draft/active/retired) e NAO resolve preco.
-- =============================================================================

create extension if not exists btree_gist;   -- necessario para EXCLUDE com = em colunas escalares

-- -----------------------------------------------------------------------------
-- price_book
-- -----------------------------------------------------------------------------
create table price_book (
  id                  uuid primary key default gen_random_uuid(),
  product_code        product_code not null,
  country             country_code not null,
  currency            currency_code not null,
  local_price         numeric(12,2) not null check (local_price > 0),
  base_price_usd      numeric(8,2) not null check (base_price_usd > 0),  -- snapshot na publicacao
  period_version      text not null,                                     -- ex.: '2026-06'
  status              price_status not null default 'active',            -- apenas workflow
  effective_from      timestamptz not null,
  effective_to        timestamptz,                                       -- null = vigente
  rounding_note       text,
  created_by_admin_id uuid not null references admin_users(id) on delete restrict,  -- (C)
  created_at          timestamptz not null default now()
);

-- T2: FK nomeada para products(code)
alter table price_book add constraint fk_price_product
  foreign key (product_code) references products(code) on update cascade;

-- (A) currency consistente com country (MVP)
alter table price_book add constraint chk_price_country_currency check (
  (country = 'MX' and currency = 'MXN') or
  (country = 'CO' and currency = 'COP') or
  (country = 'CL' and currency = 'CLP') or
  (country = 'ES' and currency = 'EUR')
);

-- coerencia de vigencia
alter table price_book add constraint chk_price_period check (
  effective_to is null or effective_to > effective_from
);

-- (v1.3 P1) no maximo uma linha vigente (aberta) por produto/pais
create unique index uq_price_current
  on price_book(product_code, country)
  where effective_to is null;

-- (B) sem sobreposicao de periodos por produto/pais.
-- Constroi um daterange a partir de effective_from/effective_to (coalesce infinito).
alter table price_book add constraint excl_price_overlap
  exclude using gist (
    product_code with =,
    country with =,
    tstzrange(effective_from, coalesce(effective_to, 'infinity'::timestamptz), '[)') with &&
  );

create index idx_price_lookup on price_book(product_code, country, effective_from desc);
create index idx_price_current_lookup on price_book(product_code, country, effective_to, effective_from);

comment on table price_book is 'Precos locais derivados do preco-base USD (A1-R). Vigencia por effective_from/effective_to; status apenas workflow. Linhas imutaveis (D).';
comment on column price_book.status is 'Workflow apenas (draft/active/retired). NAO resolve preco; a vigencia e temporal.';

-- -----------------------------------------------------------------------------
-- (D) imutabilidade de linha de preco apos criacao.
-- Mudanca de preco exige NOVA linha versionada. Permitido apenas encerrar a
-- vigencia (definir effective_to) e ajustar status no fluxo de publicacao.
-- -----------------------------------------------------------------------------
create or replace function guard_price_book_immutable()
returns trigger language plpgsql as $$
begin
  if new.local_price    is distinct from old.local_price
     or new.base_price_usd is distinct from old.base_price_usd
     or new.currency     is distinct from old.currency
     or new.country      is distinct from old.country
     or new.product_code is distinct from old.product_code
     or new.period_version is distinct from old.period_version
     or new.effective_from is distinct from old.effective_from
     or new.created_by_admin_id is distinct from old.created_by_admin_id then
    raise exception 'campos de preco/vigencia da price_book sao imutaveis; crie nova linha versionada';
  end if;
  -- permitido: definir effective_to (encerrar vigencia) e alterar status (workflow).
  -- nao permitido reabrir uma vigencia ja encerrada:
  if old.effective_to is not null and new.effective_to is distinct from old.effective_to then
    raise exception 'effective_to ja definido nao pode ser alterado';
  end if;
  return new;
end $$;

create trigger trg_price_book_immutable
  before update on price_book
  for each row execute function guard_price_book_immutable();

-- =============================================================================
-- Estrutura pronta. Valores locais dos 4 paises a inserir antes da Fase 5
-- (operacao administrativa; nao seed de migration).
-- =============================================================================
-- FIM 0007_price_book
-- =============================================================================
