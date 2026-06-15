# NUTRIPLAN — FASE 1 — ADENDO v1.2 (CORREÇÕES TÉCNICAS E CONGELAMENTO DA MODELAGEM)

Base: FINAL_IMPLEMENTATION_SPEC v8 (congelada), NUTRIPLAN_FASE_1_SPEC_TECNICA e ADENDO v1.1.
Natureza: correções técnicas de modelagem, RLS, idempotência, concorrência e autenticação. Não altera produto, regras de negócio nem decisões da v8.
Precedência: nos pontos abaixo, o v1.2 prevalece sobre a spec original e sobre o v1.1. No restante, valem a spec original e o v1.1.
Objetivo: congelar a modelagem final da Fase 1 antes das migrations.

---

## T1 — Ordem de criação e FKs (substitui a seção 10 da spec original e o ajuste de ordem do v1.1)

Causa: FKs entre `orders`, `price_book`, `admin_users` e as tabelas de plano exigem ordem fixa para não gerar FK pendente.

Ordem canônica única de criação (autoritativa):
1. Extensões: pgcrypto, citext.
2. Enums (todos, incluindo os do v1.1 e os novos deste adendo).
3. admin_users
4. products
5. users
6. leads
7. generation_sessions
8. questionnaire_answers
9. previews
10. orders
11. order_items
12. nutrition_plans
13. training_plans
14. generated_documents
15. price_book
16. webhook_logs
17. feature_flags
18. consent_records
19. email_logs
20. user_upsells
21. manual_review_queue
22. admin_audit_log
23. analytics_events (particionada) e partições inicial e default
24. Funções helper de RLS
25. Habilitação de RLS e políticas
26. Seeds (products; estrutura de price_book; feature_flags)

Regra: nenhuma tabela é criada antes de todas as suas referências existirem. `price_book` depois de `products` e `admin_users`. Tabelas de plano e documentos depois de `orders` e `users`.

---

## T2 — FK de product_code (substitui as definições de FK em price_book e order_items)

Causa: FKs apontavam para `products(code)` sem garantir o alvo único e o casamento de tipos.

Correções:
- `products.code` é do tipo enum `product_code` e possui `unique` nomeada:
```
alter table products add constraint uq_products_code unique (code);
```
- As FKs filhas referenciam explicitamente a coluna única:
```
-- price_book
alter table price_book
  add constraint fk_price_product
  foreign key (product_code) references products(code) on update cascade;

-- order_items
alter table order_items
  add constraint fk_item_product
  foreign key (product_code) references products(code) on update cascade;
```
- `price_book.product_code` e `order_items.product_code` são do tipo enum `product_code`, idêntico ao de `products.code`, garantindo compatibilidade de tipo na FK.

---

## T3 — Idempotência de pedido versus webhook (substitui os passos 3 e 4 da seção 7 e o passo 3 da seção 8 da spec original)

Causa: webhook podia chegar antes de `provider_payment_id` existir, deixando o pagamento sem pedido localizável.

Correções:
- O `idempotency_key` é gerado e persistido em `orders` antes de criar a sessão de pagamento no provider.
- O mesmo `idempotency_key` é enviado como metadata ao provider (Stripe `metadata`, Mercado Pago `external_reference`).
- O webhook localiza o pedido por `idempotency_key` (sempre presente), nunca por `provider_payment_id` como chave primária de busca.
- Se o webhook chegar e o pedido ainda não existir, gravar em `webhook_logs` com `processed=false` e reprocessar por retry; nunca descartar.

Fluxo de criação do pedido (revisado):
1. `resolvePricing(country, withTraining)` consulta a price_book vigente (regra do v1.1).
2. `createOrder`: gera `idempotency_key`, determina `provider` pela matriz, insere `orders` com `status='pending'` e `idempotency_key`, insere `order_items` validando invariantes. Se o `idempotency_key` já existir, retorna o pedido existente.
3. Cria a sessão de pagamento no provider com `idempotency_key` na metadata; persiste `provider_payment_id` quando disponível.
4. Redireciona ao pagamento.

---

## T4 — Unicidade de email_logs (substitui o índice uq_email_once da seção 2.10 da spec original)

Causa: `coalesce(order_id, lead_id)` podia colidir domínios distintos e suprimir e-mails legítimos.

Correção (remover o índice anterior e criar dois parciais):
```
drop index if exists uq_email_once;

create unique index uq_email_post_purchase
  on email_logs(order_id, email_type)
  where order_id is not null;

create unique index uq_email_cart_recovery
  on email_logs(lead_id, email_type)
  where lead_id is not null and order_id is null;
```
Sequência pós-compra deduplicada por pedido; recuperação de carrinho deduplicada por lead.

---

## T5 — Funções helper e RLS (substitui a seção 6, bloco de funções helper, da spec original)

Causa: funções helper sem `search_path` fixo e risco de policies de escrita para roles autenticadas em tabelas que devem ser escritas só por `service_role`.

Correções:
```
create or replace function current_app_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from users where auth_user_id = auth.uid()
$$;

create or replace function is_active_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users a
    where a.auth_user_id = auth.uid() and a.active
  )
$$;
```
Regras de RLS reforçadas:
- Tabelas de pedido, planos, documentos, previews, questionnaire_answers, consent_records, email_logs, webhook_logs, analytics_events e admin_audit_log: sem policy de INSERT/UPDATE para roles autenticadas. Toda escrita ocorre via `service_role`, que ignora RLS.
- SELECT do usuário final apenas por `current_app_user_id()`; SELECT administrativo por `is_active_admin()`.
- `consent_records` e `admin_audit_log` permanecem imutáveis (sem update/delete por roles autenticadas).

---

## T6 — Concorrência na geração (substitui o passo 6, início, da seção 8 da spec original)

Causa: webhooks aprovados simultâneos podiam disparar dois workers para o mesmo pedido.

Correção (transição de estado atômica e condicional, com o order_status estendido do v1.1):
```
update orders set status='generating'
where id = $1 and status='paid'
returning id;
```
- Apenas o worker que receber a linha de volta executa a geração.
- O `unique (order_id, kind)` em `generated_documents` é a segunda barreira contra PDFs duplicados.
- Guarda adicional: a criação de `nutrition_plans`/`training_plans` verifica ausência de registro prévio para o `order_id` antes de gerar.

---

## T7 — Particionamento de analytics_events (substitui a seção 2.11 da spec original)

Causa: tabela particionada sem partição cobrindo a data falha em todo INSERT.

Correção:
```
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
  primary key (id, created_at)
) partition by range (created_at);

-- partição default obrigatória
create table analytics_events_default partition of analytics_events default;

-- partição do mês corrente (exemplo; rotina cria as seguintes)
create table analytics_events_2026_06 partition of analytics_events
  for values from ('2026-06-01') to ('2026-07-01');

create index idx_analytics_event_name on analytics_events(event_name);
create index idx_analytics_created on analytics_events(created_at);
```
Nota: a PK em tabela particionada inclui a coluna de particionamento (`created_at`), exigência do Postgres. Rotina administrativa cria a partição do mês seguinte.

---

## T8 — Estado refunded e acesso (substitui a semântica de refunded na Revisão 3 do v1.1)

Causa: `refunded` após `delivered` não definia o efeito sobre o acesso.

Correção (regra de serviço, sem mudança de schema):
- `refunded` revoga o acesso ao conteúdo: o carregamento do dashboard e o download de PDFs verificam `orders.status` e negam quando `refunded`.
- Os dados (planos, documentos, pedido) não são apagados; permanecem para histórico e auditoria.
- A revogação é por verificação de status na leitura, não por exclusão de linha.

---

## T9 — Deduplicação de usuário por e-mail (substitui o passo 4 da seção 8 e complementa a seção 9 da spec original)

Causa: conversão de lead para usuário precisa ser idempotente por e-mail para suportar webhook repetido e o cenário de atraso.

Correção:
```
insert into users (email, name, country, auth_user_id)
values ($email, $name, $country, $auth_user_id)
on conflict (email) do update
  set name = excluded.name,
      country = coalesce(users.country, excluded.country),
      auth_user_id = coalesce(users.auth_user_id, excluded.auth_user_id),
      updated_at = now()
returning id;
```
`leads` permanece sem unique em e-mail (múltiplos leads do mesmo e-mail são esperados); a unicidade vive em `users.email`.

---

## ENUMS CONSOLIDADOS APÓS v1.1 E v1.2

```
-- da spec original (inalterados)
country_code, currency_code, sex_biological, goal_type, activity_level,
health_condition, physical_limitation, training_experience, training_location,
product_code, payment_provider, order_item_kind, generation_status, plan_kind,
document_kind, email_type, email_status, admin_role, review_reason, review_status,
consent_subject

-- do v1.1
price_status as enum ('draft','active','retired')
order_status as enum ('pending','paid','generating','delivered','failed','refunded')  -- estendido
```

---

## TABELAS IMPACTADAS POR ESTE ADENDO

- products: constraint única nomeada em `code` (T2).
- price_book: FK explícita para products(code); coluna `status` do v1.1 (T2, T1).
- order_items: FK explícita para products(code) (T2).
- orders: busca e idempotência por `idempotency_key`; transição atômica para `generating` (T3, T6).
- email_logs: dois índices parciais de unicidade (T4).
- webhook_logs: usada como ponto de persistência e retry (T3) — definição no v1.1.
- analytics_events: PK composta e partições default e corrente (T7).
- users: upsert idempotente por e-mail (T9).
- Funções helper: security definer com search_path (T5).

Nenhuma tabela nova é criada por este adendo além das já definidas no v1.1.

---

## FLUXO DEFINITIVO DE AUTENTICAÇÃO PÓS-PAGAMENTO — CAMINHO B (consolidado, fecha a seção 9 da spec original e a Revisão 4 do v1.1)

Decisão única, sem alternativas em aberto: conta criada pelo backend no webhook, sessão imediata, Magic Link apenas para reacesso.

Quando a conta é criada:
- No processamento do webhook de pagamento aprovado, nunca antes.

Quem cria a conta:
- O handler do webhook, com `service_role`, via Supabase Auth Admin API. Cria o registro em `auth.users` com o e-mail da compra, sem senha, e faz o upsert em `users` (T9), vinculando `auth_user_id`. Idempotente por e-mail.

Como a sessão é criada:
- O backend gera um token de acesso de uso único para o `auth_user_id` e o entrega ao front. A página de sucesso troca o token por sessão ativa e entra no dashboard, sem digitação. A criação de sessão é idempotente e acionável tanto pelo polling da página de sucesso quanto pela página de recuperação.

Como funciona a recuperação de acesso:
- Página de recuperação: o usuário informa o e-mail da compra e recebe um Magic Link do Supabase Auth. Cobre troca de dispositivo e reacesso futuro. O e-mail `delivery_d0` também contém um Magic Link.

Se o usuário fechar o navegador antes da conclusão:
- A conta é criada pelo webhook independentemente do navegador. O acesso chega por dois caminhos redundantes: Magic Link no `delivery_d0` e página de recuperação. O acesso nunca depende da sessão original.

Cenários cobertos:
- A (normal, mesmo navegador): polling detecta `paid`/`generating`/`delivered`, sessão criada, entra no dashboard.
- B (navegador fechado): acesso por Magic Link do e-mail ou página de recuperação.
- C (troca de dispositivo): autenticação do mesmo `users` por Magic Link; planos carregam via RLS.
- D (webhook atrasado): front faz polling com timeout; ao chegar o webhook, conta e sessão criadas; se exceder o timeout, acesso por e-mail. Upsert idempotente evita conta ou sessão duplicada.

Evento: `session_created_post_payment` na primeira criação de sessão, qualquer que seja o gatilho.

Schema afetado: `auth.users` (Supabase) e `users` (com `auth_user_id` e upsert por e-mail). Sem mudança adicional de schema.

---

## ESTADO DA MODELAGEM

Congelada. T1 a T9 aplicados, ordem canônica fixada, autenticação fechada no caminho B. Sem bloqueador estrutural. Pronta para a geração das migrations do Supabase numeradas, refletindo a spec original, o v1.1 e este v1.2.

Fim do adendo v1.2.
