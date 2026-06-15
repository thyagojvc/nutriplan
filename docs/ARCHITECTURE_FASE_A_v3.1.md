# NutriPlan — Arquitetura Técnica Fase A — v3.1
**Status: APROVADO PARA IMPLEMENTAÇÃO**
**Data de aprovação: 2026-06-14**

> Documento gerado após 4 rodadas de revisão técnica (v1.0 → v3.1).
> Incorpora correções de 5 críticos originais + 3 críticos novos detectados na auditoria.
> Pré-condições restantes listadas na seção final.

---

## 1. Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript estrito |
| Estilo | Tailwind CSS + shadcn/ui (mobile-first) |
| Banco | Supabase — PostgreSQL 16 + Auth + Storage |
| Deploy | Vercel |
| Analytics | PostHog + tabela `analytics_events` |
| E-mail | Resend |
| Validação | Zod (fronteira de sistema; server-side obrigatório) |
| Geração de ID | `crypto.randomUUID()` nativo |

**Fora da Fase A:** Stripe, Mercado Pago (Fase B) · GPT-5.5 / Claude Sonnet / PDF Builder (Fase C).

---

## 2. Estrutura de Diretórios

```
nutriplan/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx                        # Landing page (/)
│   │   ├── politica-privacidad/page.tsx
│   │   └── terminos/page.tsx
│   │
│   ├── (auth)/                             # [C1] sem guarda de sessão
│   │   ├── recuperar/page.tsx              # Magic Link — unauthenticated
│   │   └── acceso/page.tsx                 # Callback após Magic Link
│   │
│   ├── (quiz)/
│   │   ├── quiz/
│   │   │   ├── [step]/page.tsx             # Etapas 1–12
│   │   │   ├── procesando/page.tsx         # 15–20s + batch insert no banco
│   │   │   └── previa/page.tsx             # Preview Engine + Paywall
│   │   └── layout.tsx
│   │
│   ├── (checkout)/
│   │   ├── pago/page.tsx
│   │   └── exito/page.tsx                  # Polling — order_id na URL; key no sessionStorage
│   │
│   ├── (dashboard)/                        # guarda de sessão no layout
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── dashboard/plan-nutricional/page.tsx
│   │   └── dashboard/plan-entrenamiento/page.tsx
│   │
│   ├── api/
│   │   ├── webhooks/stripe/route.ts        # service_role obrigatório
│   │   ├── webhooks/mercadopago/route.ts   # service_role obrigatório
│   │   └── auth/session/route.ts           # [C3] service_role obrigatório
│   │
│   └── layout.tsx
│
├── actions/
│   ├── quiz.actions.ts       # initSession, saveStep, submitStep12, processQuiz
│   ├── checkout.actions.ts   # resolvePricing, createOrder
│   ├── auth.actions.ts       # sendMagicLink, getPostPaymentSession
│   └── dashboard.actions.ts  # getOrderStatus, getPlanData, getSignedDocumentUrl
│
├── components/
│   ├── ui/                   # shadcn/ui — não modificar
│   ├── quiz/
│   │   ├── QuizLayout.tsx
│   │   ├── steps/Step01.tsx … Step12ConsentimientoLead.tsx
│   │   ├── AgeGateBanner.tsx
│   │   └── CountryBlockBanner.tsx
│   ├── preview/
│   │   ├── ProcessingScreen.tsx
│   │   ├── MetricsCard.tsx
│   │   ├── PlanStructure.tsx   # placeholders apenas — NUNCA alimentos reais
│   │   ├── TrainingTeaser.tsx  # condicional a training_bump_enabled
│   │   └── PaywallCard.tsx
│   ├── checkout/
│   │   ├── OrderBumpToggle.tsx
│   │   ├── OrderSummary.tsx
│   │   └── SuccessPoller.tsx   # isAuthenticating flag; stopPolling() ao receber token
│   └── dashboard/
│       ├── DashboardShell.tsx
│       ├── OrderStatusBanner.tsx
│       ├── NutritionPlanView.tsx
│       ├── ShoppingListView.tsx
│       ├── ImplementationGuideView.tsx
│       ├── TrainingPlanView.tsx
│       └── DocumentDownloadButton.tsx  # URL assinada; nunca expõe storage_path
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts     # createBrowserClient — anon key — sujeito a RLS
│   │   ├── server.ts     # createServerClient — cookies — sujeito a RLS
│   │   ├── service.ts    # createServiceClient — service_role — bypassa RLS
│   │   │                 # IMPORTADO APENAS por lib/services/ e api/**/route.ts
│   │   └── middleware.ts
│   │
│   ├── services/
│   │   ├── session.service.ts    # createSession, saveDraftStep, getDraftAnswers
│   │   ├── consent.service.ts    # recordConsent (não chamado diretamente — via RPC)
│   │   ├── lead.service.ts       # markConverted
│   │   ├── quiz.service.ts       # insertQuestionnaireAnswers, mapAnswersToColumns
│   │   ├── pricing.service.ts    # resolvePricing — consulta price_book por vigência temporal
│   │   ├── order.service.ts      # createOrder — inclui session_id obrigatório
│   │   ├── auth.service.ts       # createUserFromWebhook, generateSessionToken, sendMagicLink
│   │   ├── preview.service.ts    # computePreview (puro), insertPreview
│   │   └── analytics.service.ts  # trackEvent
│   │
│   ├── validations/
│   │   ├── quiz.schema.ts        # age >= 18 e country ∈ {MX,CO,CL,ES} server-side
│   │   ├── checkout.schema.ts
│   │   └── consent.schema.ts
│   │
│   └── constants/
│       ├── countries.ts          # MX→MXN→mercado_pago; ES→EUR→stripe
│       ├── products.ts
│       ├── activity-factors.ts   # 1.20/1.375/1.55/1.725
│       └── analytics-events.ts
│
├── hooks/
│   ├── use-order-polling.ts
│   ├── use-quiz-state.ts     # cache local; fonte de verdade é draft_answers no banco
│   └── use-feature-flag.ts   # via Server Action + unstable_cache
│
├── types/
│   └── database.types.ts     # gerado por `supabase gen types typescript` — nunca editar
│
└── middleware.ts              # PUBLIC_PATHS explícitos: /recuperar, /acceso, /api/auth/session
```

---

## 3. Organização de Módulos

```
CAMADA 1 — Rotas / Pages / Layouts
  ↓ importa
CAMADA 2 — Server Actions (actions/*.ts) / Route Handlers (api/**/route.ts)
  ↓ importa
CAMADA 3 — Services (lib/services/*.service.ts)
  ↓ importa
CAMADA 4 — Supabase Clients (lib/supabase/{client,server,service}.ts)
```

**Regra absoluta:** `lib/supabase/service.ts` é importado apenas por Camada 3 e Route Handlers.

---

## 4. Estratégia de Autenticação

### 4.1 Identidade
- Supabase Auth — sem senha — Magic Link para reacesso
- `users.auth_user_id` ↔ `auth.users.id`: vínculo lógico, **sem FK PostgreSQL** entre schemas
- `current_app_user_id()` — SECURITY DEFINER — traduz `auth.uid()` para `users.id` no RLS

### 4.2 Criação de conta — pós-pagamento
Executado exclusivamente pelo webhook handler com service_role:
```
auth.admin.createUser({ email, email_confirm: true })  → auth_user_id
upsert em users ON CONFLICT (email) DO UPDATE          → idempotente (T9 v1.2)
```
Sessão **não** é criada pelo webhook. Criada sob demanda pelo SuccessPoller via `/api/auth/session`.

### 4.3 Sessão no navegador — /exito [ASSINATURA CONFIRMADA]
```
/exito?order=xxx
  SuccessPoller (Client Component — createBrowserClient)
  isAuthenticating = false
  │
  loop 2s:
    se isAuthenticating → return
    POST /api/auth/session
    body: { order_id, idempotency_key }   ← key do sessionStorage (não na URL)
    │
    Route Handler — service_role [C3]:
      a) orders WHERE id=? AND idempotency_key=?   [C4]
      b) status ∈ {paid, generating, delivered}
      c) email via lead_id→leads OU user_id→users
      d) auth.admin.generateLink({ type: 'magiclink', email })
         retorna data.properties.hashed_token
         NÃO envia e-mail; NÃO usa action_link (falha com PKCE)
      e) return { hashed_token }
    │
    ao receber resposta válida:
      isAuthenticating = true
      stopPolling()
      │
      supabase.auth.verifyOtp({
        token_hash: hashed_token,   ← data.properties.hashed_token
        type: 'magiclink'           ← NÃO 'email' (para OTP numérico)
      })
      ← createBrowserClient persiste sessão em cookie legível pelo middleware.ts
      │
      se error → isAuthenticating = false; botão para /recuperar
      se success → router.push('/dashboard')
```

**Estados do SuccessPoller:**

| Cenário | Comportamento |
|---|---|
| `isAuthenticating = true` | Ignora resposta; sem novo `verifyOtp` |
| Primeira resposta válida | `isAuthenticating = true` → `stopPolling()` → `verifyOtp()` |
| `verifyOtp` erro | `isAuthenticating = false`; exibe erro; oferece `/recuperar` |
| `verifyOtp` sucesso | `router.push('/dashboard')` |
| Timeout sem resposta | Link para `/recuperar` + nota de acesso por e-mail |
| `sessionStorage` vazio | Exibe timeout imediatamente; sem polling |

**Janela de validade do token:** hashed_token de magiclink tem TTL de 1h (padrão Supabase). Consumo em milissegundos após geração — sem risco de expiração em condições normais.

### 4.4 Reacesso — Magic Link
```
/recuperar (grupo (auth) — sem guarda)  [C1]
  Server Action sendMagicLink(email)
  supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '/acceso' } })
  Supabase envia e-mail com link
  /acceso: supabase.auth.exchangeCodeForSession(code) → /dashboard
```

### 4.5 Middleware
```typescript
const PUBLIC_PATHS = [
  '/', '/quiz', '/procesando', '/previa', '/pago', '/exito',
  '/recuperar',          // [C1] excluído explicitamente — sem isso → redirect loop
  '/acceso',
  '/api/auth/session',   // [C3] chamado sem sessão
  '/api/webhooks',
  '/politica-privacidad', '/terminos',
]
```

---

## 5. Supabase Clients — Regras de Uso

| Cliente | Arquivo | Onde usar |
|---|---|---|
| Browser | `client.ts` | Client Components, hooks |
| Server | `server.ts` | Server Components, Server Actions (usuário autenticado) |
| Service | `service.ts` | Services Camada 3, Route Handlers de webhook, `/api/auth/session` |

**Regra crítica [C3]:** qualquer acesso a dados sem sessão pré-existente exige `service.ts`. Usar `server.ts` nesse contexto retorna zero linhas silenciosamente (RLS bloqueia com `auth.uid() = null`).

---

## 6. Ciclo de vida de generation_sessions [C2]

### Criação — entrada do quiz (/quiz/1)
```
initSession() Server Action → service_role
INSERT generation_sessions (country=NULL, lead_id=NULL, draft_answers='{}')
→ session_id em cookie HttpOnly 'nutriplan_sid' (path=/quiz; SameSite=Strict)
Idempotente: cookie existente e válido → retorna session_id sem duplicar
```

### Auto-save — cada etapa
```
saveStep(n, data) Server Action → service_role
UPDATE generation_sessions
SET draft_answers = draft_answers || jsonb_build_object('step_N', data),
    updated_at = now()
WHERE id = session_id
```
Etapa 7 adicionalmente: `SET country = data.country`

**Fonte de verdade:**

| Cenário | sessionStorage | Cookie | DB (draft_answers) |
|---|---|---|---|
| F5 / reload | presente | presente | presente |
| Nova aba | vazio | presente | presente |
| Browser crash + reabrir | vazio | presente | presente |
| Fechar aba + reabrir | vazio | presente | presente |
| Outro dispositivo | ausente | ausente | ausente |

`sessionStorage` = cache de UI. Servidor sempre lê `draft_answers` do banco quando precisa das respostas.

### Passo 12 — Atomicidade via RPC [C5]
```
submitStep12() → supabase.rpc('submit_quiz_step12_atomic', params) — service_role

PL/pgSQL (transação implícita BEGIN/COMMIT):
  1. INSERT leads (email, name, country) → lead_id
  2. INSERT consent_records (subject_kind='lead', lead_id=<acima>, ...)
     ← chk_consent_subject_ref exige lead_id IS NOT NULL → ordem obrigatória
  3. UPDATE generation_sessions SET lead_id=?, updated_at=now()
     WHERE id=? AND country IS NOT NULL   ← guarda: etapa 7 obrigatória
  ROLLBACK automático se qualquer passo falhar
```

**O guardrail "consentimento antes do lead" é preservado:** dentro da transação, lead e consent existem simultaneamente para qualquer observador externo. Nenhum sistema externo enxerga um lead sem seu consentimento vinculado.

### Batch insert — /procesando
```
processQuiz() → service_role
  getDraftAnswers(session_id do cookie) → draft_answers
  computePreview(draft_answers)         → puro, sem HTTP, sem IA
  INSERT questionnaire_answers (session_id, lead_id, colunas estruturadas, answers_json)
  INSERT previews (session_id, bmr, tdee, target_kcal, protein_g, meals_count, metrics_json)
```

---

## 7. createOrder — Campos Obrigatórios [I7]

```typescript
createOrder({
  leadId: string,
  sessionId: string,           // FK orders.session_id → generation_sessions.id
  country: country_code,
  currency: currency_code,     // derivado de country via constants/countries.ts
  provider: payment_provider,  // mercado_pago (MX/CO/CL) | stripe (ES)
  idempotencyKey: string,
  withTraining: boolean,
  pricingResult: PricingResult // retornado por resolvePricing()
})
```

**Campo `unit_price`** (não `local_price`) em `order_items` — conforme migration 0005.

**Encadeamento:** `orders.session_id → generation_sessions.id → questionnaire_answers.session_id`
O worker de geração (Fase C) lê as respostas via esse encadeamento.

---

## 8. Fluxo de Checkout — Alto Nível

```
PRÉ-CONDIÇÕES:
  • passo 12 concluído: consent_records + leads + generation_sessions atualizado [C5]
  • session_id em cookie [C2]
  • questionnaire_answers + previews persistidos [C2]
  • país ∈ {MX,CO,CL,ES}; idade ≥ 18 — validados server-side (Zod)
  • idempotency_key gerado no cliente (crypto.randomUUID()); em sessionStorage

1. resolvePricing(country, withTraining) → price_book query por effective_from/to
2. createOrder(input com session_id) → orders + order_items (unit_price)
3. Criar sessão no provider [Fase B stub]
4. Redirect → provider

5. /exito?order=xxx (idempotency_key em sessionStorage, NÃO na URL)
   SuccessPoller polling /api/auth/session

6. Webhook [Fase B]:
   a) Verificar assinatura do provider                [I1]
   b) INSERT webhook_logs com signature_valid         [I1 — ANTES da lógica]
   c) Se signature_valid=false → 400
   d) Dedup por (provider, provider_event_id)
   e) Localiza order por idempotency_key              [T3 v1.2]
   f) orders.status → 'paid'
   g) createUserFromWebhook → auth.admin.createUser + upsert users
   h) leads.converted = true
   i) Enfileira geração [Fase C]
   j) UPDATE webhook_logs: processed=true, order_id

7. Polling detecta status ≥ paid
   → /api/auth/session: order_id + idempotency_key [C4]
   → generateLink → hashed_token
   → verifyOtp({ token_hash, type: 'magiclink' })
   → router.push('/dashboard')

8. /dashboard
   generating/needs_review → OrderStatusBanner
   delivered → planos renderizados
   refunded → 403 (dados preservados, acesso revogado por status)
```

---

## 9. Migration 0013 — Conteúdo Definitivo

```sql
-- 1. generation_sessions.country nullable
ALTER TABLE generation_sessions ALTER COLUMN country DROP NOT NULL;

-- 2. draft_answers para auto-save server-side
ALTER TABLE generation_sessions ADD COLUMN draft_answers jsonb NOT NULL DEFAULT '{}';

-- 3. Índice para jobs de limpeza e analytics de abandono
CREATE INDEX idx_gen_sessions_updated_at ON generation_sessions(updated_at);

-- 4. RPC atômica (PL/pgSQL — transação implícita)
CREATE OR REPLACE FUNCTION submit_quiz_step12_atomic(
  p_session_id     uuid,
  p_ip             inet,
  p_country        country_code,
  p_policy_version text,
  p_consent_text   text,
  p_email          citext,
  p_name           text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lead_id uuid;
BEGIN
  INSERT INTO leads (email, name, country)
    VALUES (p_email, p_name, p_country) RETURNING id INTO v_lead_id;

  INSERT INTO consent_records
    (subject_kind, lead_id, policy_version, consent_text, ip_address, country)
    VALUES ('lead', v_lead_id, p_policy_version, p_consent_text, p_ip, p_country);

  UPDATE generation_sessions
    SET lead_id = v_lead_id, updated_at = now()
    WHERE id = p_session_id AND country IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_invalid_or_country_missing: %', p_session_id;
  END IF;

  RETURN v_lead_id;
END; $$;
```

**Gate:** migration 0013 aprovada somente com `smoke_phase1.sql` verde.

---

## 10. Convenções

- **Banco:** `snake_case` · **TS:** `camelCase`/`PascalCase`
- `unit_price` em `order_items` (não `local_price`)
- Feature flag do treino: `training_bump_enabled` (não `training_enabled`)
- `service.ts` nunca importado por Server Actions ou componentes
- Preço nunca calculado no cliente — sempre via `resolvePricing()`
- `supabase gen types typescript` após qualquer migration — `database.types.ts` nunca editado à mão
- Atomicidade: operações com dependência de ordem → RPC PL/pgSQL, nunca Server Actions em sequência pelo cliente

---

## 11. Pré-condições para Iniciar Codificação

- [ ] Aplicar migrations 0001–0012 (já validadas)
- [ ] Implementar e aplicar migration 0013
- [ ] `smoke_phase1.sql` verde com 0013 aplicada
- [ ] Confirmar em ambiente local:
  - `admin.generateLink({ type: 'magiclink', email })` retorna `data.properties.hashed_token`
  - `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` cria sessão válida
  - `middleware.ts` detecta essa sessão via cookie após `verifyOtp()`

---

## 12. Checklist Pós-MVP — Observabilidade de Banco

Monitorar após escala de tráfego:

```sql
-- Tamanho médio de draft_answers
SELECT avg(pg_column_size(draft_answers)) FROM generation_sessions;

-- Bloat da tabela
SELECT * FROM pg_stat_user_tables WHERE relname = 'generation_sessions';

-- Frequência de UPDATE (hot pages)
SELECT n_tup_upd, n_tup_ins FROM pg_stat_user_tables
WHERE relname = 'generation_sessions';
```

JSONB com merges incrementais via `||` em tabela de alta escrita pode gerar TOAST bloat em produção. Avaliar `VACUUM ANALYZE generation_sessions` periódico ou revisão da estratégia de draft se o volume indicar necessidade.

---

## Histórico de Revisões

| Versão | Mudanças principais |
|---|---|
| v1.0 | Documento inicial |
| v2.0 | C1 (rota /recuperar), C2 (generation_sessions), C3 (service_role), C5 (atomicidade), I1 (webhook order), I4 (API Supabase), I7 (session_id em createOrder) |
| v3.0 | C2-novo (sessão criada no passo 12 — errado), C3-novo (duas fontes de verdade), C5-novo (falsa atomicidade); Solução: sessão em /quiz/1, draft_answers no banco, RPC PL/pgSQL. Descoberta de chk_consent_subject_ref. Correção de unit_price e nome de feature flag |
| v3.1 | I4 fechado: assinatura exata de generateLink + verifyOtp confirmada. Race condition SuccessPoller documentada com flag isAuthenticating. Índice idx_gen_sessions_updated_at adicionado à migration 0013. Checklist TOAST pós-MVP |
