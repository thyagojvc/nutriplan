# NUTRIPLAN — FASE 1 — ESPECIFICAÇÃO TÉCNICA DE IMPLEMENTAÇÃO

Base: FINAL_IMPLEMENTATION_SPEC v8 (congelada)
Escopo desta fase: banco de dados, enums, price_book, orders, tabelas administrativas, RLS e fluxos de checkout, webhook e autenticação pós-pagamento.
Stack alvo: Supabase (PostgreSQL 15+), Auth, Storage. Next.js 15 (Server Actions e Route Handlers) na camada de aplicação.
Convenções: snake_case; PK `id uuid default gen_random_uuid()`; timestamps `timestamptz default now()`; soft policies via RLS; FKs com `on delete` explícito.

Pré-requisitos de extensão:
- `create extension if not exists "pgcrypto";` (gen_random_uuid)
- `create extension if not exists "citext";` (e-mails case-insensitive)

---

## 1. ENUMS

```
create type country_code as enum ('MX','CO','CL','ES');
create type currency_code as enum ('MXN','COP','CLP','EUR');

create type sex_biological as enum ('female','male');
create type goal_type as enum ('lose_fat','gain_muscle','maintain','health_energy');
create type activity_level as enum ('sedentary','light','regular','very_active');

create type health_condition as enum ('none','pregnant','hypertension','heart_disease','diabetes','other');
create type physical_limitation as enum ('none','knee','lower_back','shoulder','wrist_elbow','varicose','other');

create type training_experience as enum ('beginner','intermediate','advanced');
create type training_location as enum ('gym','home_equipped','home_no_equipment','outdoor');

create type product_code as enum ('PLAN_STANDARD','TRAINING_BUMP','RECIPES_PACK','SHOPPING_LIST_PREMIUM','PLAN_UPDATE');

create type order_status as enum ('pending','paid','failed','refunded');
create type payment_provider as enum ('stripe','mercado_pago');
create type order_item_kind as enum ('nutrition','training','upsell');

create type generation_status as enum ('queued','processing','completed','failed','manual_review');
create type plan_kind as enum ('nutrition','training');

create type document_kind as enum ('nutrition_plan','implementation_guide','training_plan');

create type email_type as enum (
  'delivery_d0','implementation_d2','common_errors_d5','social_proof_d10','renewal_d20',
  'cart_recovery_1h','cart_recovery_24h','cart_recovery_72h'
);
create type email_status as enum ('queued','sent','failed','skipped');

create type admin_role as enum ('superadmin','operator','support','read_only');
create type review_reason as enum ('restriction_unresolved','generation_failed','validation_failed');
create type review_status as enum ('open','in_progress','resolved','discarded');

create type consent_subject as enum ('lead','user');
```

---

## 2. SCHEMA DE BANCO DE DADOS

### 2.1 users

```
create table users (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique,                       -- referência ao Supabase auth.users
  email           citext not null unique,
  name            text not null,
  country         country_code,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_users_auth_user_id on users(auth_user_id);
```

### 2.2 leads

```
create table leads (
  id              uuid primary key default gen_random_uuid(),
  email           citext not null,
  name            text not null,
  country         country_code not null,
  user_id         uuid references users(id) on delete set null,
  converted       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_leads_email on leads(email);
create index idx_leads_converted on leads(converted);
```

### 2.3 generation_sessions

Sessão que liga o questionário ao pedido e às gerações.

```
create table generation_sessions (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid references leads(id) on delete set null,
  user_id         uuid references users(id) on delete set null,
  country         country_code not null,
  status          generation_status not null default 'queued',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_gen_sessions_lead on generation_sessions(lead_id);
create index idx_gen_sessions_user on generation_sessions(user_id);
```

### 2.4 questionnaire_answers

Respostas em JSONB mais colunas indexáveis para regras de negócio.

```
create table questionnaire_answers (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references generation_sessions(id) on delete cascade,
  lead_id               uuid references leads(id) on delete set null,
  -- dados estruturados para regras
  sex                   sex_biological not null,
  age                   int not null check (age >= 18 and age <= 80),
  weight_kg             numeric(5,1) not null check (weight_kg >= 40 and weight_kg <= 250),
  height_cm             numeric(5,1) not null check (height_cm >= 130 and height_cm <= 220),
  goal                  goal_type not null,
  activity              activity_level not null,
  country               country_code not null,
  health_conditions     health_condition[] not null default '{none}',
  physical_limitations  physical_limitation[] not null default '{none}',
  training_experience   training_experience,
  training_location     training_location,
  training_frequency    int check (training_frequency between 2 and 5),
  -- payload completo (favoritos, inegociável, restrições, obstáculo, textos)
  answers_json          jsonb not null,
  created_at            timestamptz not null default now()
);
create index idx_qa_session on questionnaire_answers(session_id);
create index idx_qa_answers_gin on questionnaire_answers using gin (answers_json);
```

Regra de aplicação (camada de serviço, não trigger): se `health_conditions` contém `pregnant` e `goal = 'lose_fat'`, a aplicação sobrepõe para `maintain` antes de persistir o plano. Persistir o objetivo original em `answers_json.goal_original` para auditoria.

### 2.5 products

```
create table products (
  id              uuid primary key default gen_random_uuid(),
  code            product_code not null unique,
  name            text not null,
  base_price_usd  numeric(8,2) not null,             -- 9.90 / 4.90 (referência interna)
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
```

Seed obrigatório:
```
insert into products (code, name, base_price_usd) values
 ('PLAN_STANDARD','Plan Nutricional', 9.90),
 ('TRAINING_BUMP','Plan de Entrenamiento', 4.90);
```

### 2.6 previews

Apenas métricas e parâmetros; nunca refeições reais (Decisão 9-R).

```
create table previews (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references generation_sessions(id) on delete cascade,
  bmr             numeric(7,1) not null,             -- TMB
  tdee            numeric(7,1) not null,             -- GET
  target_kcal     numeric(7,1) not null,
  protein_g       numeric(6,1) not null,
  meals_count     int not null,
  metrics_json    jsonb not null,                    -- indicadores e estrutura com placeholders
  created_at      timestamptz not null default now()
);
create index idx_previews_session on previews(session_id);
```

### 2.7 nutrition_plans

```
create table nutrition_plans (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders(id) on delete cascade,
  user_id             uuid not null references users(id) on delete cascade,
  session_id          uuid references generation_sessions(id) on delete set null,
  cycle_days          int not null default 7,
  cycle_weeks         int not null default 4,
  clinical_flags      health_condition[] not null default '{none}',
  general_guidance    boolean not null default false,  -- diabetes/outra => true
  plan_json           jsonb not null,                  -- 7 dias, refeições, substituições, lista de compras, guia
  model_used          text,
  prompt_version      text,
  created_at          timestamptz not null default now()
);
create index idx_nutrition_plans_order on nutrition_plans(order_id);
create index idx_nutrition_plans_user on nutrition_plans(user_id);
```

### 2.8 training_plans

Criado apenas se o treino constar no pedido pago.

```
create table training_plans (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders(id) on delete cascade,
  user_id             uuid not null references users(id) on delete cascade,
  session_id          uuid references generation_sessions(id) on delete set null,
  clinical_flags      health_condition[] not null default '{none}',
  limitations         physical_limitation[] not null default '{none}',
  plan_json           jsonb not null,
  model_used          text,
  prompt_version      text,
  created_at          timestamptz not null default now()
);
create index idx_training_plans_order on training_plans(order_id);
create index idx_training_plans_user on training_plans(user_id);
```

### 2.9 generated_documents

```
create table generated_documents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  order_id        uuid not null references orders(id) on delete cascade,
  kind            document_kind not null,
  storage_path    text not null,                     -- bucket privado por usuário
  file_name       text not null,
  created_at      timestamptz not null default now(),
  unique (order_id, kind)
);
create index idx_docs_user on generated_documents(user_id);
```

### 2.10 email_logs

```
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
create index idx_email_logs_type on email_logs(email_type);
create index idx_email_logs_order on email_logs(order_id);
create unique index uq_email_once on email_logs(coalesce(order_id, lead_id), email_type);
```

### 2.11 analytics_events

```
create table analytics_events (
  id              uuid primary key default gen_random_uuid(),
  event_name      text not null,
  session_id      uuid,
  lead_id         uuid,
  user_id         uuid,
  order_id        uuid,
  country         country_code,
  properties      jsonb not null default '{}',
  created_at      timestamptz not null default now()
) partition by range (created_at);

-- partições mensais (criar via rotina administrativa)
create index idx_analytics_event_name on analytics_events(event_name);
create index idx_analytics_created on analytics_events(created_at);
```

### 2.12 user_upsells

```
create table user_upsells (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  order_id        uuid not null references orders(id) on delete cascade,
  product_code    product_code not null,
  created_at      timestamptz not null default now()
);
create index idx_user_upsells_user on user_upsells(user_id);
```

### 2.13 consent_records (F3)

```
create table consent_records (
  id                  uuid primary key default gen_random_uuid(),
  subject_kind        consent_subject not null,
  lead_id             uuid references leads(id) on delete set null,
  user_id             uuid references users(id) on delete set null,
  policy_version      text not null,
  consent_text        text not null,
  ip_address          inet not null,
  country             country_code not null,
  consented_at        timestamptz not null default now()
);
create index idx_consent_lead on consent_records(lead_id);
create index idx_consent_user on consent_records(user_id);
```

---

## 3. PRICE_BOOK (A1-R)

Tabela interna de preços locais derivados do preço-base em USD, versionada por período e por vigência. Sem conversão em tempo real.

```
create table price_book (
  id                  uuid primary key default gen_random_uuid(),
  product_code        product_code not null references products(code) on update cascade,
  country             country_code not null,
  currency            currency_code not null,
  local_price         numeric(12,2) not null check (local_price > 0),
  base_price_usd      numeric(8,2) not null,         -- snapshot do preço-base no momento da publicação
  period_version      text not null,                 -- ex.: '2026-06'
  effective_from      timestamptz not null,
  effective_to        timestamptz,                   -- null = vigente
  rounding_note       text,
  published_by        uuid references admin_users(id) on delete set null,
  created_at          timestamptz not null default now()
);

-- integridade país/moeda do MVP
alter table price_book add constraint chk_country_currency check (
  (country = 'MX' and currency = 'MXN') or
  (country = 'CO' and currency = 'COP') or
  (country = 'CL' and currency = 'CLP') or
  (country = 'ES' and currency = 'EUR')
);

-- no máximo um preço vigente por produto/país
create unique index uq_price_active
  on price_book(product_code, country)
  where effective_to is null;

create index idx_price_lookup on price_book(product_code, country, effective_from desc);
```

Regra de consulta da versão ativa (camada de serviço):
```
select local_price, currency, period_version
from price_book
where product_code = $1
  and country = $2
  and effective_from <= now()
  and (effective_to is null or effective_to > now())
order by effective_from desc
limit 1;
```

Regra de publicação de nova versão (transação administrativa):
1. `update price_book set effective_to = now() where product_code = $1 and country = $2 and effective_to is null;`
2. `insert into price_book (...) values (... effective_from = now(), effective_to = null ...);`
3. Operação executada apenas por `admin_role in ('superadmin','operator')` e registrada em `admin_audit_log`.

Seed inicial (valores locais a preencher antes da Fase 5; estrutura pronta):
```
-- exemplo de linha (valor local a definir):
-- insert into price_book(product_code,country,currency,local_price,base_price_usd,period_version,effective_from)
-- values ('PLAN_STANDARD','MX','MXN', <valor>, 9.90, '2026-06', now());
```

---

## 4. ORDERS E ORDER_ITEMS (Decisão 14)

Pedido único, pagamento único, treino opcional, idempotência.

```
create table orders (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid references users(id) on delete set null,
  lead_id                 uuid references leads(id) on delete set null,
  session_id              uuid references generation_sessions(id) on delete set null,
  status                  order_status not null default 'pending',
  country                 country_code not null,
  currency                currency_code not null,
  total_amount            numeric(12,2) not null check (total_amount >= 0),
  provider                payment_provider not null,
  provider_payment_id     text,
  price_book_period_version text not null,
  idempotency_key         text not null unique,
  paid_at                 timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index idx_orders_status on orders(status);
create index idx_orders_user on orders(user_id);
create unique index uq_orders_provider_payment
  on orders(provider, provider_payment_id)
  where provider_payment_id is not null;

create table order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders(id) on delete cascade,
  kind                order_item_kind not null,
  product_code        product_code not null references products(code) on update cascade,
  local_price         numeric(12,2) not null check (local_price >= 0),
  currency            currency_code not null,
  created_at          timestamptz not null default now(),
  unique (order_id, product_code)
);
create index idx_order_items_order on order_items(order_id);
```

Invariantes (camada de serviço):
- Todo pedido tem exatamente 1 item `kind='nutrition'` com `product_code='PLAN_STANDARD'`.
- O item `kind='training'` (`TRAINING_BUMP`) é opcional, no máximo 1.
- `total_amount = soma(order_items.local_price)`; `currency` única por pedido.
- `currency` deriva do `country` conforme o constraint do price_book.

---

## 5. TABELAS ADMINISTRATIVAS (A5, F7)

### 5.1 admin_users

```
create table admin_users (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique not null,              -- Supabase auth, com MFA obrigatório
  email           citext not null unique,
  role            admin_role not null default 'read_only',
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz
);
```

### 5.2 admin_audit_log

```
create table admin_audit_log (
  id              uuid primary key default gen_random_uuid(),
  admin_id        uuid references admin_users(id) on delete set null,
  action          text not null,                     -- ex.: 'price_book.publish', 'order.reprocess', 'user_data.view'
  target_table    text,
  target_id       uuid,
  ip_address      inet,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index idx_audit_admin on admin_audit_log(admin_id);
create index idx_audit_action on admin_audit_log(action);
create index idx_audit_created on admin_audit_log(created_at);
```

Regra: toda leitura de dados de usuário e todo reprocessamento de pedido pela área administrativa grava uma linha aqui antes de executar a ação.

### 5.3 manual_review_queue (F7)

```
create table manual_review_queue (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  plan_kind       plan_kind not null,
  reason          review_reason not null,
  status          review_status not null default 'open',
  attempts        int not null default 0,
  details         jsonb not null default '{}',       -- itens de exclusão não resolvidos, logs
  assigned_admin  uuid references admin_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index idx_review_status on manual_review_queue(status);
create index idx_review_order on manual_review_queue(order_id);
```

---

## 6. POLÍTICAS RLS POR TABELA

Habilitar RLS em todas as tabelas. Padrões de identidade:
- Usuário final: `auth.uid()` corresponde a `users.auth_user_id`.
- Admin: existência em `admin_users` com `active = true`; papel define o nível.
- Operações de sistema (geração, webhooks, e-mails): executadas com `service_role`, que ignora RLS.

Helper sugerido:
```
create or replace function current_app_user_id() returns uuid
language sql stable as $$
  select id from users where auth_user_id = auth.uid()
$$;

create or replace function is_active_admin(min_role admin_role default 'read_only') returns boolean
language sql stable as $$
  select exists (
    select 1 from admin_users a
    where a.auth_user_id = auth.uid() and a.active
  )
$$;
```

Políticas por tabela:

| Tabela | SELECT | INSERT | UPDATE | DELETE |
| users | dono (`auth_user_id = auth.uid()`) ou admin | service_role | dono (campos limitados) ou admin | admin (superadmin) |
| leads | admin | service_role | service_role/admin | superadmin |
| generation_sessions | dono via user_id ou admin | service_role | service_role | superadmin |
| questionnaire_answers | dono via session/user ou admin | service_role | nenhum | superadmin |
| previews | dono via session ou admin | service_role | nenhum | superadmin |
| products | público autenticado (SELECT) | superadmin | superadmin | superadmin |
| price_book | público autenticado (apenas linha vigente via view) | operator+ | operator+ | superadmin |
| orders | dono via user_id ou admin | service_role | service_role/admin | superadmin |
| order_items | dono via join orders ou admin | service_role | service_role | superadmin |
| nutrition_plans | dono via user_id ou admin | service_role | service_role | superadmin |
| training_plans | dono via user_id ou admin | service_role | service_role | superadmin |
| generated_documents | dono via user_id ou admin | service_role | service_role | superadmin |
| email_logs | admin | service_role | service_role | superadmin |
| analytics_events | admin | service_role | nenhum | superadmin |
| user_upsells | dono ou admin | service_role | service_role | superadmin |
| consent_records | dono ou admin | service_role | nenhum (imutável) | superadmin |
| admin_users | admin (superadmin gerencia) | superadmin | superadmin | superadmin |
| admin_audit_log | admin | service_role/admin | nenhum (imutável) | nenhum |
| manual_review_queue | admin | service_role | operator+ | superadmin |

Exemplos de policy:

```
alter table users enable row level security;

create policy users_select_self_or_admin on users
for select using (auth_user_id = auth.uid() or is_active_admin());

create policy users_update_self on users
for update using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());
```

```
alter table nutrition_plans enable row level security;

create policy np_select_owner_or_admin on nutrition_plans
for select using (user_id = current_app_user_id() or is_active_admin());
-- INSERT/UPDATE somente via service_role (sem policy para roles autenticadas)
```

```
alter table consent_records enable row level security;

create policy consent_select_owner_or_admin on consent_records
for select using (
  (subject_kind = 'user' and user_id = current_app_user_id())
  or is_active_admin()
);
-- consentimento é imutável: sem policy de update/delete para roles autenticadas
```

```
alter table price_book enable row level security;

create policy price_select_authenticated on price_book
for select using (auth.role() = 'authenticated');
-- escrita restrita a service_role/admin operator+ via aplicação
```

```
alter table admin_audit_log enable row level security;

create policy audit_select_admin on admin_audit_log
for select using (is_active_admin());
-- imutável: sem update/delete
```

Para campos sensíveis de saúde em `questionnaire_answers`, o acesso de usuário final deve ser via join controlado por `generation_sessions.user_id = current_app_user_id()`; o acesso administrativo passa obrigatoriamente por gravação em `admin_audit_log` na camada de aplicação.

---

## 7. FLUXO TÉCNICO: CHECKOUT ATÉ A CRIAÇÃO DO PEDIDO

Pré-condições: lead capturado, consentimento registrado, país no escopo, idade >= 18 validada na etapa 5.

1. Cliente seleciona produto principal e, opcionalmente, o order bump de treino.
2. Server Action `resolvePricing(country, withTraining)`:
   - Consulta `price_book` (regra da seção 3) para `PLAN_STANDARD` e, se aplicável, `TRAINING_BUMP`.
   - Retorna `local_price` por item, `currency`, `period_version`.
   - Emite `checkout_price_resolved`.
3. Server Action `createOrder`:
   - Gera `idempotency_key` (uuid v4 do cliente persistido na sessão; reuso em retentativas).
   - Determina `provider` pela matriz (MX/CO/CL = mercado_pago; ES = stripe).
   - Insere `orders` com `status='pending'`, `currency`, `total_amount`, `price_book_period_version`, `provider`, `idempotency_key`.
   - Insere `order_items` (nutrition obrigatório; training se selecionado), validando invariantes da seção 4.
   - Idempotência: se `idempotency_key` já existe, retorna o pedido existente sem duplicar.
4. Cria a sessão de pagamento no provider na moeda local; persiste `provider_payment_id` quando disponível.
5. Emite `checkout_started`, `order_bump_added` (se aplicável).
6. Redireciona o cliente para o pagamento do provider.

Nenhuma geração de IA ou nutricional ocorre nesta etapa.

---

## 8. FLUXO TÉCNICO: WEBHOOK ATÉ A GERAÇÃO ASSÍNCRONA

Endpoint: Route Handler dedicado por provider, executado com `service_role`.

1. Receber o webhook. Verificar a assinatura do provider (Stripe signing secret; Mercado Pago validação de origem). Rejeitar se inválida.
2. Persistir o payload bruto (tabela de log de webhook ou `analytics_events` com `event_name='webhook_received'`) antes de qualquer lógica.
3. Idempotência: localizar a `orders` pela `provider_payment_id` ou pela `idempotency_key`. Se o pedido já está `paid`, encerrar com 200 sem reprocessar (proteção contra entrega duplicada).
4. Se evento = pagamento aprovado:
   - `update orders set status='paid', paid_at=now()` (transação).
   - Garantir `users`: se não existe, criar a partir do lead (email, name, country) e vincular `auth_user_id`. Marcar `leads.converted=true`.
   - Registrar `user_upsells` para itens de upsell, se houver.
   - Enfileirar geração: criar/atualizar `generation_sessions.status='queued'`.
   - Emitir `payment_approved`.
5. Se evento = falha:
   - `update orders set status='failed'`. Nenhum item liberado. Emitir `payment_failed`.
6. Worker assíncrono de geração (fila), com guarda de idempotência por `order_id`:
   - Construir lista de exclusões (restrições mais condições) e enviar ao Motor Nutricional (Camada 1 de F7).
   - Gerar `nutrition_plans` (sempre). Gerar `training_plans` apenas se existir `order_items.kind='training'`.
   - Validador determinístico (Camada 2 de F7): verificar exclusões; substituir item a item (máx. 3 tentativas por item). Se irresolúvel, criar `manual_review_queue` e não entregar plano com item proibido.
   - Aplicar regras clínicas (gestante = manutenção; flags e `general_guidance`).
   - Persistir planos com `model_used` e `prompt_version`. Emitir `ai_generation_started` e `ai_generation_completed`.
   - Acionar PDF Builder: gerar `generated_documents` (nutrição sempre; treino condicional). Emitir `pdf_generated`.
   - Renderizar conteúdo no dashboard a partir do `plan_json` (entrega primária HTML).
   - Enfileirar `email_logs` `delivery_d0` e a sequência pós-compra.

Reprocessamento seguro: repetir o passo 6 não duplica entrega, pois a guarda de idempotência por `order_id` impede segunda geração e o `unique (order_id, kind)` em `generated_documents` impede PDFs duplicados.

---

## 9. FLUXO TÉCNICO: AUTENTICAÇÃO PÓS-PAGAMENTO (F17)

Objetivo: acesso imediato sem depender de e-mail.

1. Ao confirmar `orders.status='paid'` (retorno do provider para a aplicação ou polling do front na página de sucesso):
   - A aplicação cria uma sessão autenticada para o `users` correspondente (Supabase Auth: criar usuário se necessário e iniciar sessão; usar magic link de uso imediato consumido no servidor ou criação de sessão via admin API com `service_role`).
   - Redirecionar automaticamente para o dashboard. Emitir `session_created_post_payment`.
2. O conteúdo (planos e PDFs) é exibido assim que a geração conclui; até lá, o dashboard mostra estado de processamento, sem depender de e-mail.
3. Acessos futuros:
   - Magic Link por e-mail (Supabase Auth) para novo login.
   - Página de recuperação: usuário informa o e-mail da compra, recebe Magic Link e acessa.
4. Contingências (navegador fechado, celular reiniciado, redirecionamento falho): a página de recuperação por e-mail cobre todos os casos; o e-mail de entrega `delivery_d0` também contém acesso.

RLS garante que cada usuário só enxerga seus próprios `orders`, `nutrition_plans`, `training_plans` e `generated_documents` via `current_app_user_id()`.

---

## 10. ORDEM DE EXECUÇÃO DA FASE 1

1. Extensões e enums (seções 1).
2. Tabelas base sem FKs circulares: products, admin_users.
3. users, leads, generation_sessions, questionnaire_answers, previews.
4. orders, order_items (FKs para users, leads, sessions, products).
5. nutrition_plans, training_plans, generated_documents (FK para orders, users).
6. price_book (FK para products e admin_users), com constraint país/moeda e índice de vigência.
7. consent_records, email_logs, user_upsells, manual_review_queue, admin_audit_log.
8. analytics_events particionada e partições iniciais.
9. Funções helper de RLS e habilitação de RLS com políticas (seção 6).
10. Seeds: products, e estrutura de price_book pronta para preenchimento (valores locais antes da Fase 5).

Observação de dependência: `orders` é referenciada por `nutrition_plans`, `training_plans`, `generated_documents`, e `price_book` referencia `admin_users`. Criar na ordem acima evita FK pendente. Para a FK de `nutrition_plans.order_id` e `previews`/`generation_sessions`, manter a ordem 3 a 5.

Fim da especificação técnica da Fase 1.
