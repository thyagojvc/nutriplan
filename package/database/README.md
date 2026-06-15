# NutriPlan — Banco de Dados (Fase 1)

Fonte da verdade: `produto_v8` (congelada) e os documentos técnicos da Fase 1
(Spec Técnica, adendos v1.1, v1.2 e v1.3). As migrations e o smoke test deste
diretório implementam exatamente essas decisões. Não reinterprete decisões já
tomadas; mudanças de schema exigem nova migration e devem manter o smoke test verde.

## Estrutura

```
database/
├── migrations/    0001 a 0012 (ordem de execução obrigatória)
├── tests/         smoke_phase1.sql
└── README.md
```

## Dependências

- PostgreSQL 16 ou superior.
- Extensões: `pgcrypto`, `citext`, `btree_gist` (criadas pelas migrations).
- Supabase Auth: as migrations assumem `auth.uid()` e `auth.role()` (existem no
  Supabase). Em banco local de teste, criar stubs antes (ver "Validação local").
- Supabase Storage: buckets privados por usuário para os PDFs (provisionamento manual).

## Ordem de execução

Aplicar estritamente nesta ordem:

```
0001_extensions_enums
0002_admin_products
0003_core_user_lead_session
0004_questionnaire_previews
0005_orders_items
0006_plans_documents
0007_price_book
0008_webhook_feature_flags
0009_consent_email_upsell_review_audit
0010_analytics_partitions
0011_functions_rls
0012_seeds
```

A ordem é obrigatória por causa das FKs (ex.: `price_book` depende de `products`
e `admin_users`; planos e documentos dependem de `orders` e `users`).

## Como aplicar

```bash
for f in database/migrations/0*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

No Supabase, aplicar via CLI de migrations ou pelo editor SQL, na mesma ordem.

## Como validar (smoke test)

Após aplicar as 12 migrations, rodar:

```bash
psql "$DATABASE_URL" -f database/tests/smoke_phase1.sql
```

Saída esperada: `SMOKE TEST PHASE 1: PASSED`. O teste roda em transação com
`ROLLBACK` ao final, então não deixa resíduo. Qualquer regressão levanta
`ASSERT FALHOU: <mensagem>` e interrompe.

O smoke test cobre: criação de pedido; unique de `idempotency_key`; unique
parcial de `provider_payment_id`; item nutricional único por pedido;
imutabilidade de `orders` e `order_items`; overlap e check país/moeda da
`price_book`; dedup de webhook; append-only de `consent_records` e
`admin_audit_log`; unique `(order_id, kind)` e substituição em
`generated_documents`; RLS de usuário, support e superadmin; analytics
particionado com RLS.

## Validação local (sem Supabase)

Para rodar em um PostgreSQL local, criar os stubs de auth antes das migrations:

```sql
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true),''),'authenticated') $$;
```

Esses stubs são apenas para teste local; no Supabase as funções já existem.

## Provisionamento manual (fora das migrations, antes do go-live)

Nenhuma credencial ou preço é criado por migration. Provisionar manualmente:

1. Primeiro superadmin: criar usuário no Supabase Auth (com MFA) e inserir a
   linha correspondente em `admin_users` via `service_role`.
2. Preços locais: preencher `price_book` para PLAN_STANDARD e TRAINING_BUMP nos
   4 países (MX/MXN, CO/COP, CL/CLP, ES/EUR), com `created_by_admin_id` do
   superadmin. Sem isso, o checkout (Fase 5) não resolve preço.
3. Stripe: chaves e webhook (assinatura verificada no handler).
4. Mercado Pago: chaves e webhook (validação de origem).
5. Buckets privados de Storage por usuário, para os PDFs.
6. Política de Privacidade e Termos de Uso publicados; registrar a
   `policy_version` usada no consentimento.

## Operação contínua — analytics_events

A tabela `analytics_events` é particionada por mês. Rotina operacional obrigatória:

- Criar a partição de N+2 meses à frente (antecedência), via `select create_analytics_partition(ano, mes);`.
- Monitorar o volume da partição `analytics_events_default`. Ela é rede de segurança, não destino normal. Se começar a receber volume relevante, é sinal de que a rotina de criação de partições falhou e precisa de correção.

## Notas de modelo (resumo das decisões já congeladas)

- Escrita de sistema (webhooks, geração, e-mails, criação de pedido, publicação
  de preço, reprocessamento) ocorre via `service_role`, que ignora RLS.
- Usuário final só enxerga as próprias linhas; acesso administrativo é
  segmentado por papel (`support`, `operator`, `read_only`, `superadmin`).
- Preço local vem da `price_book` versionada por vigência temporal
  (`effective_from`/`effective_to`); `status` é apenas workflow.
- Valor cobrado é congelado em `orders.total_amount` e `order_items.unit_price`;
  não recalcular por mudança futura de preço.
- `order_status`: pending, paid, generating, needs_review, delivered, failed, refunded.
- Reembolso parcial não existe na Fase 1.
- Entrega primária é o dashboard HTML; PDFs são complementares.
