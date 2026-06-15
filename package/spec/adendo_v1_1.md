# NUTRIPLAN — FASE 1 — ADENDO v1.1 (REVISÕES TÉCNICAS)

Base: FINAL_IMPLEMENTATION_SPEC v8 (congelada) e NUTRIPLAN_FASE_1_SPEC_TECNICA.
Natureza: detalhamento técnico de implementação. Não altera produto, regras de negócio nem decisões da v8.
Este adendo prevalece sobre os trechos correspondentes da spec técnica da Fase 1 nos cinco pontos abaixo. Todo o restante permanece válido.

---

## REVISÃO 1 — Estado de publicação na price_book

Decisão técnica: em vez de um `is_active` solto (que duplicaria a verdade do `effective_to`), usar um enum de estado de publicação, preservando a regra de no máximo uma versão ativa por produto e país.

Novo enum:
```
create type price_status as enum ('draft','active','retired');
```

Ajuste em `price_book`:
```
alter table price_book add column status price_status not null default 'active';
```

Regras:
- `draft`: versão preparada (por exemplo, a de julho), ainda não vigente.
- `active`: versão vigente; no máximo uma por produto e país.
- `retired`: versão desativada ou substituída.

Substituir o índice de unicidade de vigência por um baseado no estado:
```
drop index if exists uq_price_active;
create unique index uq_price_active
  on price_book(product_code, country)
  where status = 'active';
```

Regra de consulta da versão vigente (substitui a da spec anterior):
```
select local_price, currency, period_version
from price_book
where product_code = $1
  and country = $2
  and status = 'active'
  and effective_from <= now()
  and (effective_to is null or effective_to > now())
limit 1;
```

Operações administrativas (transação, `admin_role in ('superadmin','operator')`, registradas em `admin_audit_log`):
- Preparar julho: `insert ... status='draft'`.
- Publicar julho: `update price_book set status='retired', effective_to=now() where product_code=$1 and country=$2 and status='active';` seguido de `update price_book set status='active', effective_from=now() where id = <draft_id>;`.
- Rollback rápido de uma tabela problemática: `update price_book set status='retired' where id=<id>;` e reativar a anterior, ou publicar uma nova `active`.

`effective_from` e `effective_to` continuam existindo para histórico e auditoria; o `status` é a chave operacional de ativação e rollback.

---

## REVISÃO 2 — Tabela webhook_logs

Decisão técnica: criar tabela dedicada para o payload bruto e o rastreio de processamento, em vez de usar `analytics_events`.

```
create table webhook_logs (
  id                  uuid primary key default gen_random_uuid(),
  provider            payment_provider not null,
  provider_event_id   text,
  provider_payment_id text,
  event_type          text,
  payload_json        jsonb not null,
  signature_valid     boolean not null default false,
  processed           boolean not null default false,
  processed_at        timestamptz,
  order_id            uuid references orders(id) on delete set null,
  error_detail        text,
  created_at          timestamptz not null default now()
);
create unique index uq_webhook_event on webhook_logs(provider, provider_event_id)
  where provider_event_id is not null;
create index idx_webhook_payment on webhook_logs(provider_payment_id);
create index idx_webhook_processed on webhook_logs(processed);
```

Uso no fluxo de webhook (substitui o passo 2 da seção 8 da spec anterior):
1. Receber e verificar assinatura. Inserir em `webhook_logs` com `signature_valid` e `payload_json` antes de qualquer lógica.
2. Deduplicação por `uq_webhook_event`: se `provider_event_id` já existe processado, encerrar com 200 sem reprocessar.
3. Após processar, `update webhook_logs set processed=true, processed_at=now(), order_id=...`. Em erro, gravar `error_detail` e deixar `processed=false` para reprocessamento.

RLS: SELECT apenas admin; INSERT/UPDATE via `service_role`; sem update por roles autenticadas; tabela não exposta a usuários finais.

---

## REVISÃO 3 — Ciclo de vida do pedido: separar pago de entregue

Decisão técnica: estender `order_status` para distinguir cobrança de entrega, integrando com a fila de geração e a `manual_review_queue`.

Novo conjunto de status:
```
-- substitui o enum anterior
-- ordem lógica: pending -> paid -> generating -> delivered
--                                 \-> failed (pagamento)
--                                 \-> refunded (pós-pagamento)
create type order_status as enum ('pending','paid','generating','delivered','failed','refunded');
```

Semântica:
- `pending`: pedido criado, pagamento não confirmado.
- `paid`: pagamento aprovado; geração ainda não concluída.
- `generating`: worker em execução (nutrição e, se aplicável, treino).
- `delivered`: planos validados, documentos gerados e conteúdo disponível no dashboard.
- `failed`: falha de pagamento (nenhum item liberado).
- `refunded`: reembolsado após pagamento.

Transições (camada de serviço):
- Webhook aprovado: `pending -> paid`.
- Worker inicia: `paid -> generating`.
- Worker conclui com sucesso e documentos prontos: `generating -> delivered`.
- Worker manda item para revisão manual: mantém `generating` e cria `manual_review_queue`; só vai a `delivered` quando resolvido.
- Reembolso: qualquer estado pós-pagamento `-> refunded`.

Métrica habilitada: comprou (`paid`) versus recebeu (`delivered`), medida diretamente pelo status, sem inferência.

Impacto em eventos (já previstos): `payment_approved` na entrada de `paid`; `ai_generation_started` em `generating`; `ai_generation_completed` e a entrega na transição para `delivered`.

---

## REVISÃO 4 — Autenticação pós-pagamento detalhada (F17)

Princípio: a fonte de verdade do acesso é o `orders.status` mais o vínculo do `users`, nunca o e-mail. O e-mail é contingência. A sessão é criada de forma idempotente, podendo ser disparada tanto pelo retorno do navegador quanto pelo webhook.

Componentes:
- `users.auth_user_id` vincula o cliente ao Supabase Auth.
- Criação de usuário e sessão é idempotente por e-mail do pedido (não duplica conta em retentativas).
- Página de sucesso do front faz polling do `orders.status`.

### Cenário A — Pagamento normal, mesmo navegador
1. Provider redireciona para a página de sucesso com referência ao pedido.
2. O front faz polling de `orders.status`.
3. Em paralelo, o webhook marca `paid` e garante o `users` (cria se necessário).
4. Assim que `users` existe e o pedido está `paid`/`generating`/`delivered`, o servidor cria a sessão autenticada (Supabase Auth admin API com `service_role`) e o front entra no dashboard.
5. Enquanto o status for `generating`, o dashboard mostra estado de processamento; ao virar `delivered`, exibe os planos.

### Cenário B — Navegador fechado durante o pagamento
1. Não há página de sucesso para receber o retorno.
2. O webhook processa o pagamento, cria o `users` e marca o pedido.
3. O e-mail `delivery_d0` contém um Magic Link de acesso direto ao dashboard.
4. Alternativamente, o usuário acessa a página de recuperação, informa o e-mail da compra e recebe o Magic Link.
5. Em ambos os caminhos, o acesso não depende de a sessão original ter sido criada no navegador que fechou.

### Cenário C — Troca de dispositivo
1. O usuário paga em um aparelho e abre o produto em outro.
2. No novo dispositivo, usa a página de recuperação ou o Magic Link do e-mail.
3. O Supabase Auth autentica o mesmo `users` (mesmo `auth_user_id`), e o dashboard carrega os planos vinculados ao usuário via RLS.
4. Nenhuma sessão é presumida entre dispositivos; cada um autentica pelo Magic Link.

### Cenário D — Pagamento aprovado, webhook atrasado
1. O front está na página de sucesso fazendo polling, mas o pedido ainda está `pending` porque o webhook não chegou.
2. O front mantém o polling com timeout visível e mensagem de processamento de pagamento.
3. Quando o webhook chega, o pedido vira `paid`, o `users` é criado e o polling detecta a mudança, criando a sessão e entrando no dashboard.
4. Se o webhook demorar além do timeout do front, a página instrui o usuário de que o acesso chegará por e-mail e oferece a página de recuperação. O `delivery_d0` cobre o caso.
5. A criação de sessão é idempotente: se o usuário tentar pela recuperação e o webhook chegar logo depois, não há duplicação de conta nem de sessão.

Regra transversal: a criação de `users` e a criação de sessão nunca dependem uma da outra em ordem fixa; ambas são acionáveis por webhook ou por recuperação por e-mail, e ambas são idempotentes por e-mail do pedido. Isso elimina o estado de cliente pago sem acesso.

Eventos: `session_created_post_payment` na primeira criação de sessão, independentemente do gatilho.

---

## REVISÃO 5 — Tabela feature_flags (versão mínima)

Decisão técnica: criar a tabela e um leitor simples na Fase 1; não construir painel de gestão agora (fora do escopo).

```
create table feature_flags (
  key             text primary key,
  enabled         boolean not null default false,
  description     text,
  updated_by      uuid references admin_users(id) on delete set null,
  updated_at      timestamptz not null default now()
);
```

Seeds iniciais (exemplos alinhados à v8, sem ativar comportamento novo):
```
insert into feature_flags(key, enabled, description) values
 ('training_enabled', true,  'Habilita o order bump de treino'),
 ('preview_v2',       false, 'Reservado para futura variação de prévia'),
 ('new_prompt',       false, 'Reservado para versão alternativa de prompt');
```

Leitor (camada de serviço): consulta simples por `key`, com cache curto em memória. Flags não alteram regras da v8; servem para habilitar ou desabilitar funcionalidades já especificadas sem deploy.

RLS: SELECT para admin e `service_role`; escrita restrita a `service_role` ou `admin_role in ('superadmin','operator')`.

---

## CONSOLIDAÇÃO DOS ENUMS NOVOS E ALTERADOS

```
create type price_status as enum ('draft','active','retired');
-- order_status passa a ser:
create type order_status as enum ('pending','paid','generating','delivered','failed','refunded');
```

## TABELAS NOVAS NESTE ADENDO

- webhook_logs
- feature_flags
- (price_book ganha coluna status; orders usa o novo order_status)

## AJUSTE NA ORDEM DE EXECUÇÃO DA FASE 1

Inserir, após a criação de `orders` e `admin_users`:
1. `webhook_logs` (FK opcional para orders).
2. `feature_flags` (FK opcional para admin_users).
3. Alterar `price_book` com a coluna `status` e recriar o índice de unicidade por `status`.
4. Garantir que o enum `order_status` estendido seja criado antes de `orders`.

Fim do adendo v1.1.
