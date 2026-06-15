# NUTRIPLAN — FASE 1 — ADENDO v1.3 (FECHAMENTO FINAL DA MODELAGEM)

Base: v8 (congelada), Spec Técnica Fase 1, Adendo v1.1, Adendo v1.2.
Natureza: ajustes técnicos finais. Não altera produto nem decisões da v8.
Precedência: nos quatro pontos abaixo, o v1.3 prevalece sobre os documentos anteriores. No restante, valem v1.1 e v1.2.
Objetivo: fechar a modelagem para a geração das migrations.

---

## P1 — price_book: fonte de verdade da vigência (substitui a regra de consulta e o índice do v1.1)

Decisão definitiva: a vigência é temporal. `effective_from` e `effective_to` são a fonte de verdade do preço vigente. `status` é apenas workflow administrativo (draft, active, retired) e nunca participa da resolução do preço.

Índice de unicidade de vigência (substitui `uq_price_active` do v1.1, que usava status):
```
drop index if exists uq_price_active;
create unique index uq_price_current
  on price_book(product_code, country)
  where effective_to is null;
```
No máximo uma linha vigente (sem data de término) por produto e país.

Consulta do preço vigente (substitui a do v1.1, removendo `status`):
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

Semântica de `status` (apenas operacional):
- `draft`: linha preparada, ainda não vigente; tipicamente com `effective_from` no futuro ou não aplicado.
- `active`: rótulo informativo de workflow; não decide preço.
- `retired`: linha histórica.

Publicação de nova vigência (transação administrativa, registrada em admin_audit_log):
```
update price_book set effective_to = now(), status = 'retired'
where product_code = $1 and country = $2 and effective_to is null;

update price_book set effective_from = now(), effective_to = null, status = 'active'
where id = <linha_preparada>;
```
A divergência entre status e datas deixa de existir como risco, pois apenas as datas resolvem preço.

---

## P2 — order_status: estado explícito de revisão (substitui o enum order_status do v1.1 e a transição da Revisão 3)

Decisão definitiva: adicionar `needs_review` para tornar observável o pedido parado aguardando intervenção, separando-o de geração em andamento.

Enum final:
```
create type order_status as enum
  ('pending','paid','generating','needs_review','delivered','failed','refunded');
```

Transições (camada de serviço):
- `pending` → `paid`: webhook de pagamento aprovado.
- `paid` → `generating`: worker inicia (transição atômica do T6).
- `generating` → `delivered`: planos validados e documentos gerados.
- `generating` → `needs_review`: dupla proteção não resolveu um item em 3 tentativas, ou geração/validação falhou; cria linha em `manual_review_queue`.
- `needs_review` → `generating`: operador reprocessa (registrado em admin_audit_log).
- `needs_review` → `failed`: operador descarta.
- qualquer estado pós-pagamento → `refunded`.

Benefício de observabilidade: o dashboard e as métricas distinguem "gerando agora" de "parado aguardando revisão"; o tempo em `needs_review` é medível de forma isolada.

Acesso do cliente: em `generating` e `needs_review`, o dashboard mostra estado de processamento; o conteúdo aparece somente em `delivered`. `refunded` revoga o acesso por verificação de status (T8).

---

## P3 — feature_flags: helper de consulta (complementa a Revisão 5 do v1.1)

A tabela do v1.1 já tem `key` como PK (única por definição), `enabled boolean`, `description`. Adiciona-se o helper:
```
create or replace function is_feature_enabled(flag_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from feature_flags where key = flag_name), false)
$$;
```
Comportamento seguro: flag inexistente retorna `false`. Permite desligar funcionalidade já especificada na v8 sem deploy.

---

## P4 — webhook_logs: retry explícito (complementa a Revisão 2 do v1.1 e o T3)

Adiciona-se o contador de tentativas, do qual o retry do T3 depende:
```
alter table webhook_logs add column retry_count int not null default 0;
```

Regra de processamento e retry:
- Ao receber: inserir com `payload_json`, `signature_valid`, `processed=false`, `retry_count=0`.
- Deduplicação por `uq_webhook_event` (provider, provider_event_id).
- A cada tentativa de processamento que falhar: `retry_count = retry_count + 1`, manter `processed=false`, gravar `error_detail`.
- Ao concluir com sucesso: `processed=true`, `processed_at=now()`, vincular `order_id`.
- Teto de tentativas (5): ao atingir, manter `processed=false` para tratamento manual, sem descartar o payload. O payload bruto nunca é apagado.

Estrutura final de webhook_logs (consolidada):
```
id, provider, provider_event_id, provider_payment_id, event_type,
payload_json, signature_valid, processed, processed_at, retry_count,
order_id, error_detail, created_at
```

---

## ENUMS CONSOLIDADOS APÓS v1.3

```
price_status as enum ('draft','active','retired')              -- apenas workflow (P1)
order_status as enum ('pending','paid','generating',
                      'needs_review','delivered','failed','refunded')  -- (P2)
```
Demais enums conforme spec original, v1.1 e v1.2.

---

## IMPACTO NAS MIGRATIONS

- price_book: índice `uq_price_current` por `effective_to is null`; consulta vigente sem status (P1).
- orders: enum `order_status` com `needs_review`; transições atualizadas (P2).
- feature_flags: helper `is_feature_enabled` (P3).
- webhook_logs: coluna `retry_count` e regra de retry (P4).

Nenhuma tabela nova. Nenhuma mudança de produto.

---

## ESTADO DA MODELAGEM

Fechada. As quatro últimas checagens estão resolvidas: vigência da price_book por datas como fonte única, estado `needs_review` explícito, helper de feature flags e `retry_count` no webhook. Sem bloqueador de arquitetura. Pronta para a geração das migrations do Supabase.

Fim do adendo v1.3.
