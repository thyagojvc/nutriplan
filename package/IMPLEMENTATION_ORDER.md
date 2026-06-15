# NutriPlan — Ordem de Implementação (camada de aplicação)

A fase de banco está encerrada e validada (migrations 0001–0012 em PostgreSQL 16
limpo, smoke test verde, endurecimento de RLS e SECURITY DEFINER aplicado).
Este documento define a ordem de construção da camada de aplicação.

## Regra de ouro

As decisões de produto e de schema estão CONGELADAS em `/spec` e `/database`.
Não reinterprete decisões já tomadas. Se a implementação exigir mudança de schema,
crie uma nova migration e mantenha `database/tests/smoke_phase1.sql` verde.

Fonte da verdade, em ordem de precedência:
1. `spec/produto_v8.md`
2. `spec/spec_tecnica_fase1.md`
3. `spec/adendo_v1_1.md`, `adendo_v1_2.md`, `adendo_v1_3.md` (o mais recente prevalece nos pontos que toca)
4. `database/` (migrations e README)

## Invariantes que a aplicação deve respeitar (já garantidas no banco)

- Nenhuma chamada de IA e nenhuma geração nutricional antes do pagamento.
- Prévia 100% determinística, sem alimentos reais.
- Pedido único: nutrição obrigatória, treino opcional; pagamento único.
- Escrita de sistema via `service_role` (ignora RLS).
- Preço local resolvido pela `price_book` vigente (datas), congelado no pedido.
- Acesso pós-pagamento por sessão imediata; e-mail é contingência.
- `order_status`: pending → paid → generating → (needs_review) → delivered; failed; refunded.

---

## Fase A — Auth, Dashboard, Checkout

- Auth (Supabase): sessão pós-pagamento (caminho B) e Magic Link para reacesso.
- Dashboard HTML responsivo (entrega primária); estados de processamento por `order_status`.
- Checkout:
  - Resolver preço via `price_book` vigente (regra do README).
  - Criar `orders` (status `pending`) com `idempotency_key` e `price_book_period_version`.
  - Criar `order_items` (nutrition obrigatório; training opcional).
  - Idempotência do checkout (reuso de `idempotency_key`).

## Fase B — Pagamentos

- Stripe (Espanha/EUR; fallback dos demais) e Mercado Pago (MX/CO/CL).
- Enviar `idempotency_key` como metadata ao provider (Stripe `metadata`, MP `external_reference`).
- Webhooks: verificar assinatura; persistir bruto em `webhook_logs` antes da lógica;
  dedup por `(provider, provider_event_id)`; `retry_count` com teto.
- Transição `pending → paid`; criar/garantir `users` (upsert por e-mail); enfileirar geração.

## Fase C — Worker de geração, IA, PDFs

- Consumir pedidos pagos. Transição atômica `paid → generating`
  (`update ... where status='paid' returning id`); só o vencedor gera.
- IA pós-pagamento: GPT-5.5 principal, Claude Sonnet fallback (prompts neutros).
  - Construir lista de exclusões e enviar ao motor (prevenção).
  - Validação determinística: substituir item a item (máx. 3); sem resolver → `needs_review` + `manual_review_queue`.
- Regras clínicas (gestante = manutenção; flags; `general_guidance`).
- Gerar `nutrition_plans` (sempre) e `training_plans` (se item de treino).
- PDFs complementares; upload no Storage (bucket privado); registrar em `generated_documents`
  (`unique(order_id, kind)`; substituição via delete+insert).
- Concluir: `generating → delivered`.

## Fase D — Entrega, E-mails, Observabilidade

- Área do usuário: render do plano a partir do JSON; downloads por URL assinada temporária.
- Controle de acesso por RLS; `refunded` revoga acesso por verificação de status.
- E-mails: sequência pós-compra (D0/D2/D5/D10/D20) e recuperação de carrinho (1h/24h/72h),
  com dedup pelos índices de `email_logs`.
- Observabilidade: logs estruturados; `webhook_logs`; `admin_audit_log` (gravar antes de ações sensíveis);
  métricas operacionais (conversão, paid vs delivered, tempo em needs_review, volume da partição default de analytics); alertas.

---

## Validação contínua

Após qualquer mudança de schema:
```bash
# aplicar migrations e rodar o smoke test
psql "$DATABASE_URL" -f database/tests/smoke_phase1.sql   # espera: SMOKE TEST PHASE 1: PASSED
```
