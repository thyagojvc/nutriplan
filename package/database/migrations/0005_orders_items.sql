-- =============================================================================
-- NUTRIPLAN — MIGRATION 0005_orders_items
-- Base: Spec Tecnica Fase 1 + Adendos v1.1, v1.2, v1.3
-- Escopo: tabelas orders e order_items (modelo de cobranca - Decisao 14).
-- Ordem canonica (v1.2 T1): etapas 10 (orders) e 11 (order_items).
-- Depende de: 0001 (enums), 0002 (products.code unique), 0003 (users, leads,
--             generation_sessions).
--
-- REGRAS EXPLICITAS desta migration:
--  1. provider_payment_id: indice unico PARCIAL (permite multiplos NULL).
--  2. idempotency_key: UNIQUE NOMEADA (base do T3).
--  3. price_book_period_version: IMUTAVEL apos criacao (trigger).
--  4. Exatamente 1 item nutricional por pedido: no maximo 1 garantido por
--     indice parcial; presenca obrigatoria garantida na transacao de criacao
--     (aplicacao). Todo pedido contem PLAN_STANDARD.
--  5. total_amount: CONGELADO na compra; nao recalculado por mudanca futura
--     no price_book. Imutavel (trigger).
--  6. Reembolso parcial: NAO EXISTE na Fase 1. refunded aplica ao pedido
--     inteiro (tudo ou nada). Reembolso parcial exigiria nova modelagem.
--  7. order_items.unit_price + currency: CONGELADOS na compra (auditoria
--     historica independente do price_book). Imutaveis (trigger).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- orders (pedido unico - Decisao 14)
-- -----------------------------------------------------------------------------
create table orders (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references users(id) on delete set null,
  lead_id                   uuid references leads(id) on delete set null,
  session_id                uuid references generation_sessions(id) on delete set null,
  status                    order_status not null default 'pending',
  country                   country_code not null,
  currency                  currency_code not null,
  total_amount              numeric(12,2) not null check (total_amount >= 0),  -- congelado na compra
  provider                  payment_provider not null,
  provider_payment_id       text,
  price_book_period_version text not null,                                     -- imutavel (auditoria)
  idempotency_key           text not null,
  paid_at                   timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- (2) idempotency_key UNIQUE nomeada (base do T3)
alter table orders add constraint uq_orders_idempotency_key unique (idempotency_key);

-- (1) provider_payment_id: unico parcial (permite multiplos NULL)
create unique index uq_orders_provider_payment
  on orders(provider, provider_payment_id)
  where provider_payment_id is not null;

create index idx_orders_status on orders(status);
create index idx_orders_user on orders(user_id);
create index idx_orders_lead on orders(lead_id);

comment on table orders is 'Pedido unico (Decisao 14): nutricao obrigatoria + treino opcional. total_amount e price_book_period_version congelados na compra.';
comment on column orders.total_amount is 'Valor congelado no momento da compra. Nao recalculado por alteracoes futuras no price_book.';
comment on column orders.price_book_period_version is 'Versao da tabela de precos aplicada na compra. Imutavel apos criacao.';

-- -----------------------------------------------------------------------------
-- order_items
-- -----------------------------------------------------------------------------
create table order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  kind         order_item_kind not null,
  product_code product_code not null,
  unit_price   numeric(12,2) not null check (unit_price >= 0),   -- (7) congelado na compra
  currency     currency_code not null,                          -- (7) congelado na compra
  created_at   timestamptz not null default now()
);

-- T2: FK nomeada para products(code)
alter table order_items add constraint fk_item_product
  foreign key (product_code) references products(code) on update cascade;

-- impede duplicar o mesmo produto no pedido
alter table order_items add constraint uq_order_item_product unique (order_id, product_code);

-- (4) no maximo 1 item nutricional por pedido (a presenca obrigatoria e
--     garantida na transacao de criacao na aplicacao)
create unique index uq_order_one_nutrition
  on order_items(order_id)
  where kind = 'nutrition';

create index idx_order_items_order on order_items(order_id);

comment on table order_items is 'Itens do pedido. unit_price e currency congelados na compra. No maximo 1 nutrition por pedido; presenca de PLAN_STANDARD garantida na transacao de criacao.';

-- -----------------------------------------------------------------------------
-- (3)(5) IMUTABILIDADE: price_book_period_version e total_amount em orders;
--        unit_price e currency em order_items.
-- Objetivo: preservar a rastreabilidade historica do preco cobrado.
-- -----------------------------------------------------------------------------
create or replace function guard_orders_immutable_fields()
returns trigger language plpgsql as $$
begin
  if new.price_book_period_version is distinct from old.price_book_period_version then
    raise exception 'price_book_period_version e imutavel apos a criacao do pedido';
  end if;
  if new.total_amount is distinct from old.total_amount then
    raise exception 'total_amount e imutavel apos a criacao do pedido';
  end if;
  return new;
end $$;

create trigger trg_orders_immutable
  before update on orders
  for each row execute function guard_orders_immutable_fields();

create or replace function guard_order_items_immutable_fields()
returns trigger language plpgsql as $$
begin
  if new.unit_price is distinct from old.unit_price
     or new.currency is distinct from old.currency
     or new.product_code is distinct from old.product_code then
    raise exception 'unit_price, currency e product_code sao imutaveis em order_items';
  end if;
  return new;
end $$;

create trigger trg_order_items_immutable
  before update on order_items
  for each row execute function guard_order_items_immutable_fields();

-- =============================================================================
-- FIM 0005_orders_items
-- =============================================================================
