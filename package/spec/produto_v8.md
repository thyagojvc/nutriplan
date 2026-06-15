# NUTRIPLAN — FINAL_IMPLEMENTATION_SPEC v8

Versão consolidada 8.0
Status: A1-R aplicado; Espanha definida como Stripe único; sem bloqueador de arquitetura
Origem: v7 mais A1-R e definição de gateway da Espanha

Este documento substitui a v7 como fonte principal da verdade.

---

## 0. Registro de decisões aprovadas

- Decisões 1 a 9-R, F1, F2, F3, F7, F17, 14, 15, 16, A2 a A6: conforme v7.
- A1-R (preço-base global mais tabela local periódica): substitui A1.
  - Posicionamento comercial mantido em US$ 9,90 (nutrição) e US$ 4,90 (treino).
  - USD como moeda de referência interna do produto.
  - Sem conversão cambial em tempo real no checkout.
  - Tabela interna de preços locais por país e moeda, derivada do preço-base em USD.
  - Tabela atualizada manualmente ou por rotina administrativa periódica (por exemplo, mensal).
  - Preços locais arredondados para valores comerciais adequados em cada moeda.
  - O usuário vê apenas o preço local final; nunca vê USD, câmbio, IOF ou conversão.
  - Checkout cobra diretamente na moeda local; a moeda cobrada é persistida no pedido.
  - Atualizações cambiais relevantes revisam a tabela local sem alterar o posicionamento global.
- Espanha: gateway único Stripe, sem fallback cruzado (encerra a pendência localizada da v7).

---

## 1. Hierarquia de autoridade

1. Decisões aprovadas (seção 0)
2. Decisões Arquiteturais Globais (DAG)
3. Motor Nutricional v1
4. Motor de Treino v1
5. Preview + Paywall
6. Build Spec
7. Banco de Dados Definitivo
8. Arquitetura Técnica
9. Sprint Plan

---

## 2. Visão do produto

- Produto principal: plano alimentar personalizado, posicionado em US$ 9,90, cobrado em moeda local derivada do preço-base.
- Order bump: plano de treino, posicionado em US$ 4,90, cobrado em moeda local, no mesmo pedido.
- Mercado do MVP: México, Colômbia, Chile e Espanha. Idioma: espanhol regional.
- Dispositivo principal: mobile.
- Público: exclusivamente 18 anos ou mais.
- Posicionamento: plano do próximo mês, ciclo semanal de 7 dias repetível por 4 semanas.

### 2.1 Composição comercial

Produto principal: plano alimentar de 7 dias, substituições, lista de compras, guia de implementação, entrega em HTML responsivo e PDFs complementares.
Order bump: plano de treino personalizado, entrega em HTML e PDF complementar.

---

## 3. Funil consolidado

1. Landing page
2. Questionário de 12 etapas com auto-save
3. Tela de processamento de 15 a 20 segundos (percepção)
4. Preview Engine determinístico (métricas, indicadores, estrutura com placeholders, sem alimentos reais)
5. Prévia e teaser de treino
6. Captura de lead com consentimento
7. Paywall na moeda local do país
8. Checkout de pedido único na moeda local
9. Webhook idempotente de pagamento aprovado
10. Sessão autenticada e redirecionamento imediato
11. Geração assíncrona do plano nutricional; treino se constar no pedido
12. Validação (dupla proteção de restrições)
13. Renderização no dashboard HTML; PDFs complementares
14. E-mail de entrega
15. Sequências de e-mail e upsells

---

## 4. Questionário (12 etapas)

1. Alimentos favoritos
2. Objetivo
3. Alimento inegociável
4. Sexo biológico
5. Dados físicos (idade mínima 18, peso 40 a 250 kg, altura 130 a 220 cm)
6. Nível de atividade (4 níveis: 1,20; 1,375; 1,55; 1,725)
7. País (apenas México, Colômbia, Chile e Espanha no MVP)
8. Restrições alimentares
9. Triagem de saúde (multiselect: nenhuma, gestante, hipertensão, doença cardíaca, diabetes, outra)
10. Experiência, local, frequência e limitações musculoesqueléticas
11. Obstáculo principal
12. Consentimento, nome e e-mail

Regras de idade (F1), triagem (F2) e consentimento (F3) conforme v7. O país (etapa 7) determina a moeda local do paywall e do checkout. Países fora do escopo não aparecem nem são aceitos.

---

## 5. Motor Nutricional v1 (pós-pagamento)

Geração completa de 7 dias do zero. Mifflin-St Jeor; fatores 1,20; 1,375; 1,55; 1,725. Ajuste por objetivo e macros conforme v7. Regras por condição de saúde conforme v7 (gestante em manutenção; hipertensão ou cardíaca conservador; diabetes e outra como orientação geral; disclaimers). País, restrições, favoritos, inegociável, medidas caseiras, substituições e validações integrais conforme Motor Nutricional v1.

---

## 6. Motor de Treino v1 (pós-pagamento; condicional ao pedido)

Executado apenas se o treino constar no pedido. Limitações musculoesqueléticas (etapa 10) e condições clínicas (etapa 9) conforme v7. Regras integrais conforme Motor de Treino v1.

---

## 7. Preview Engine e Paywall

Prévia determinística sem alimentos reais, sem IA, sem geração nutricional. Exibe resumo, métricas, indicadores, estrutura com placeholders e teaser de treino. Tela de percepção de 15 a 20 segundos. Paywall exibe produto principal e order bump no preço local final, sem qualquer referência a USD ou câmbio.

---

## 8. Arquitetura de IA

Modelos: GPT-5.5 principal, Claude Sonnet fallback; desenvolvimento com Claude Code; prompts neutros. Camada determinística pré-pagamento e camada de IA pós-pagamento conforme v7. Dupla proteção de restrições (F7): prevenção mais validação determinística com substituição item a item, máximo de 3 tentativas e dead-letter.

### 8.1 Requisitos de validação do modelo (A3)

Na Fase 3: validar disponibilidade do GPT-5.5, custo por token e limites de rate; manter escolha de modelo por configuração; manter fallback testado antes do go-live.

---

## 9. Stack oficial

Next.js 15, TypeScript, Tailwind, shadcn/ui na Vercel; Supabase (PostgreSQL, Auth, Storage); GPT-5.5 com fallback Claude Sonnet; Stripe e Mercado Pago multi-moeda; Resend; PostHog mais tabela interna; fila obrigatória para geração pós-pagamento.

---

## 10. Banco de dados (CHANGED — A1-R)

Tabelas: users, leads, generation_sessions, questionnaire_answers, nutrition_plans, training_plans, previews, orders, order_items, products, price_book, generated_documents, email_logs, analytics_events, user_upsells, consent_records, manual_review_queue, admin_users, admin_audit_log.

Ajustes consolidados:
- products: PLAN_STANDARD e TRAINING_BUMP, com base_price_usd de referência (9,90 e 4,90).
- price_book (CHANGED — A1-R): tabela interna de preços locais derivados do preço-base em USD. Campos por linha: product_code, country, currency, local_price, base_price_usd, period_version, effective_from, effective_to, rounding_note. Permite versionamento por período e histórico; sem conversão em tempo real. Atualizada manualmente ou por rotina administrativa periódica.
- orders: pedido único; status, currency, total_amount, provider, provider_payment_id, idempotency_key, price_book_period_version (registra a versão de preço aplicada).
- order_items: nutrição (obrigatória) e treino (opcional), com local_price e currency efetivamente cobrados.
- nutrition_plans, training_plans, previews, generated_documents, consent_records, manual_review_queue, admin_users, admin_audit_log: conforme v7.
- email_logs: enums de sequência pós-compra e recuperação de carrinho.
- RLS por usuário; tabelas de sistema e admin restritas.

---

## 11. Pagamentos e acesso pós-pagamento

### 11.1 Atomicidade (Decisão 14)

Pedido único com pagamento único; treino opcional liberado apenas se constar no pedido; falha não libera nada; webhooks idempotentes; reprocessamento sem duplicação; geração protegida por idempotência.

### 11.2 Preço-base global e tabela local (CHANGED — A1-R)

- Posicionamento em US$ 9,90 e US$ 4,90; USD como referência interna.
- Preço local final vindo da price_book, derivado do preço-base e arredondado comercialmente.
- Sem conversão cambial em tempo real; a versão de preço vigente do período é aplicada no checkout.
- A versão de preço aplicada e a moeda cobrada são persistidas no pedido.
- Revisões cambiais relevantes geram nova versão da price_book, sem alterar o posicionamento global.
- O usuário vê apenas o preço local final, sem USD, câmbio ou IOF.

### 11.3 Matriz de países do MVP (CHANGED — Espanha Stripe único)

| País | Moeda | Gateway principal | Gateway fallback |
| México | MXN | Mercado Pago | Stripe |
| Colômbia | COP | Mercado Pago | Stripe |
| Chile | CLP | Mercado Pago | Stripe |
| Espanha | EUR | Stripe | nenhum (Stripe único) |

Para a Espanha, o Stripe é o gateway único; a resiliência se apoia em retry e nos métodos alternativos do próprio Stripe. Países fora desta lista não aparecem no questionário nem são aceitos no checkout no MVP.

### 11.4 Acesso pós-pagamento (F17)

Sessão autenticada imediata, redirecionamento para a área do cliente, conteúdo disponível sem depender de e-mail; Magic Link e recuperação por e-mail para acessos futuros.

---

## 12. PDFs (Decisão 16)

Material complementar e de impressão. Nutricionais sempre (plano de 7 dias com nota de ciclo, guia, disclaimers e observações clínicas); treino condicional. Gerados do Master Plan JSON pelo PDF Builder. Regeneráveis.

---

## 13. Área do cliente (Decisão 16, F17)

Entrega primária em HTML responsivo, acesso imediato pós-pagamento por sessão, consumo de 100% do plano pelo dashboard, exibindo plano alimentar, substituições, lista de compras, guia e treino (quando adquirido). PDFs como complemento. Magic Link e recuperação por e-mail para acessos futuros.

---

## 14. Analytics e e-mails

### 14.1 Eventos

landing_started, landing_cta_clicked, questionnaire_started, questionnaire_step_completed, age_gate_blocked, country_unsupported_blocked, questionnaire_completed, consent_given, preview_rendered, preview_viewed, lead_captured, checkout_started, order_bump_viewed, order_bump_added, checkout_price_resolved, checkout_abandoned, cart_recovery_email_sent, cart_recovered, payment_approved, payment_failed, session_created_post_payment, ai_generation_started, ai_generation_completed, restriction_substitution, manual_review_queued, dashboard_viewed, plan_section_viewed, pdf_generated, pdf_downloaded, account_created, upsell_viewed, upsell_purchased.

### 14.2 Sequência pós-compra

D0 entrega, D2 implementação, D5 erros comuns, D10 prova social, D20 renovação.

### 14.3 Recuperação de carrinho

1 hora, 24 horas, 72 horas. Sem descontos. Encerra com pagamento.

---

## 15. Upsells

Produto principal, order bump de treino e upsells previstos, todos com preço local derivado do preço-base via price_book.

---

## 16. Conformidade, dados de saúde e go-live (A4, A5, A6)

### 16.1 Dados de saúde e privacidade

Idade mínima de 18; consentimento registrado (timestamp, versão da política, IP, país) antes da captura de lead; dados de saúde como sensíveis; direitos de exclusão, retenção configurável e auditoria de consentimento; disclaimers por condição clínica no dashboard e nos PDFs.

### 16.2 Requisitos legais de go-live (A4)

Política de Privacidade publicada; Termos de Uso publicados; versão dos documentos registrada junto ao consentimento; conformidade com LGPD e GDPR quando aplicável.

### 16.3 Administração (A5)

RBAC; autenticação forte para administradores; auditoria de ações sensíveis; logs de reprocessamento; logs de acesso a dados de usuários.

### 16.4 Diretrizes de marketing (A6)

Evitar promessas de resultado; evitar números específicos de perda de peso; evitar linguagem que gere reprovação em Meta e Google; revisar landing page e criativos antes das campanhas.

---

## 17. Regras críticas de implementação

- Produto exclusivo para 18 anos ou mais.
- MVP apenas em México, Colômbia, Chile e Espanha; demais países bloqueados.
- Nenhuma IA e nenhuma geração nutricional antes do pagamento.
- Prévia sem alimentos reais.
- Pedido único com pagamento único; treino opcional liberado só se no pedido; falha não libera nada.
- Webhooks idempotentes; reprocessamento sem duplicação; geração idempotente.
- Posicionamento global em USD; preço local final pela price_book versionada; sem conversão em tempo real; usuário nunca vê USD nem câmbio; moeda e versão de preço persistidas.
- Espanha com Stripe único.
- Entrega primária em HTML; PDF complementar.
- Plano completo gerado por IA, do zero, apenas pós-pagamento.
- Dupla proteção de restrições com substituição item a item, máximo de 3 tentativas e dead-letter.
- Condições clínicas alimentam nutrição e treino, com disclaimers.
- Consentimento registrado antes da captura de lead.
- Acesso imediato pós-pagamento por sessão, sem depender de e-mail.
- Admin com RBAC, autenticação forte e auditoria.
- Toda geração de IA é assíncrona; a prévia é síncrona e instantânea.
- 4 níveis de atividade; fator 1,90 não usado.
- RLS protege todos os dados; não expor prompts, chaves ou dados de terceiros.
- Mobile-first; não implementar fora do escopo.

---

## 18. Critérios de aceitação do MVP

Usuário maior de 18, em um dos 4 países, consegue, sem suporte humano: responder o questionário com triagem e consentimento, ver a prévia determinística, ver o preço local final, comprar em pedido único (com ou sem treino), ser autenticado e redirecionado imediatamente, consumir 100% do plano no dashboard HTML, baixar PDFs complementares e voltar a acessar.

Verificações específicas:
- Bloqueio de menores de 18 e de países fora do escopo.
- Consentimento registrado com versão dos documentos.
- Prévia sem alimentos reais; métricas coincidem com o plano.
- Pedido único: aprovação libera nutrição e treino (se no pedido); falha não libera nada; reprocessamento não duplica.
- Preço local final pela price_book; versão de preço e moeda persistidas; cobrança no gateway correto por país; Espanha em Stripe.
- Dashboard exibe plano, substituições, lista, guia e treino (se adquirido); PDFs disponíveis.
- Nenhum alimento de exclusão no plano; substituições registradas; casos não resolvidos na fila.
- Acesso pós-pagamento sem e-mail; recuperação por e-mail funciona.
- Admin com RBAC e auditoria operando.
- Cobertura dos 14 testes do QA Checklist.

---

## 19. Plano de implementação por fases

- Fase 0 e 1: liberadas (banco inclui price_book, admin_users, admin_audit_log).
- Fase 2: liberada.
- Fase 3: liberada, com requisitos de validação do GPT-5.5 (A3).
- Fase 4: liberada.
- Fase 5: liberada; requer a price_book preenchida com os preços locais vigentes dos 4 países.
- Fase 6, 7, 8: liberadas.
- Fase 9: liberada; inclui RBAC e auditoria do admin e o fallback de IA testado.

Requisitos de go-live: price_book preenchida e publicada, documentos legais publicados (A4) e revisão de marketing (A6).

---

## 20. Status dos bloqueadores

Resolvidos ou eliminados: F1, F2, F3, F7, F8, F11, F15, F16, F17, F20, F21, F24, A1-R, A2, A3, A4, A5, A6, e a pendência da Espanha.
Bloqueador de arquitetura ou de início: nenhum.

---

## 21. Pendências operacionais agendadas (não bloqueiam o início)

- Preencher os valores da price_book para os 4 países (antes da Fase 5).
- Validar GPT-5.5 em disponibilidade, custo e rate (na Fase 3).
- Publicar Política de Privacidade e Termos com versionamento (antes do go-live).
- Revisar landing page e criativos para compliance de anúncios (antes das campanhas).

Ajustes não bloqueantes remanescentes: F4, F5, F9, e reforços F10, F18, F22, F23.

---

## 22. Declaração de prontidão

Aprovado para desenvolvimento, sem bloqueador de arquitetura, de início ou de decisão pendente. As pendências da seção 21 são operacionais e legais, com momento de resolução definido por fase e por go-live, e não impedem o início imediato das Fases 0 a 4.
