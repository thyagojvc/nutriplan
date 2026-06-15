-- =============================================================================
-- NUTRIPLAN — MIGRATION 0002_admin_products
-- Base: Spec Tecnica Fase 1 + Adendos v1.1, v1.2, v1.3
-- Escopo: tabelas admin_users e products.
-- Ordem canonica (v1.2 T1): etapas 3 (admin_users) e 4 (products).
-- Depende de: 0001 (enums admin_role, product_code).
--
-- CONFIRMACOES desta migration:
--  - auth_user_id NAO tem FK direta para auth.users (schema gerenciado pelo
--    Supabase). Vinculo garantido na camada de aplicacao. Apenas unique.
--  - NENHUM superadmin e criado automaticamente. O primeiro admin sera
--    provisionado manualmente apos criar o usuario no Supabase Auth com MFA.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- admin_users (A5)
-- -----------------------------------------------------------------------------
create table admin_users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique,            -- referencia logica a auth.users (sem FK direta)
  email         citext not null unique,
  role          admin_role not null default 'read_only',
  active         boolean not null default true,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

comment on table admin_users is 'Usuarios administrativos (RBAC). auth_user_id vincula logicamente a auth.users, sem FK direta.';
comment on column admin_users.auth_user_id is 'UUID do usuario no Supabase Auth. MFA obrigatorio (politica de aplicacao). Sem FK direta para auth.users.';

create index idx_admin_users_role on admin_users(role) where active;

-- -----------------------------------------------------------------------------
-- products
-- base_price_usd: referencia interna (A1-R). Precos locais vivem em price_book (0007).
-- -----------------------------------------------------------------------------
create table products (
  id             uuid primary key default gen_random_uuid(),
  code           product_code not null,
  name           text not null,
  base_price_usd numeric(8,2) not null check (base_price_usd >= 0),
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- T2: constraint unica nomeada em code, alvo das FKs de price_book e order_items.
alter table products add constraint uq_products_code unique (code);

comment on table products is 'Catalogo de produtos. base_price_usd e referencia interna em USD; preco local final vem de price_book.';

-- -----------------------------------------------------------------------------
-- SEED de produtos (nao e credencial; valores de referencia da v8)
-- -----------------------------------------------------------------------------
insert into products (code, name, base_price_usd) values
  ('PLAN_STANDARD', 'Plan Nutricional',        9.90),
  ('TRAINING_BUMP', 'Plan de Entrenamiento',   4.90);

-- =============================================================================
-- FIM 0002_admin_products
-- =============================================================================
