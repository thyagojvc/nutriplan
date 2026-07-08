-- NutriPlan — adiciona o novo tipo de documento bônus (Guía Anti-Celulitis)
-- Rodar no SQL Editor do Supabase (painel > SQL Editor). Idempotente.
--
-- IMPORTANTE: rodar o PASSO 1 sozinho primeiro (selecione só essa linha e
-- clique em Run). O Postgres não deixa usar um valor novo de enum na mesma
-- transação em que ele foi criado. Só depois de rodar e essa 1ª execução
-- terminar, selecione e rode o PASSO 2 numa 2ª execução separada.

-- ── PASSO 1 (rodar sozinho) ──────────────────────────────────────────────
ALTER TYPE document_kind ADD VALUE IF NOT EXISTS 'anti_celulitis';

-- ── PASSO 2 (rodar depois, em execução separada) ────────────────────────
-- Conferência: o novo valor deve aparecer na lista
SELECT enum_range(NULL::document_kind);
