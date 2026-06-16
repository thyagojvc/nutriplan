-- =============================================================================
-- NUTRIPLAN — MIGRATION 0016_expand_countries_enum
-- Adiciona 'OTHER'/'USD' aos enums country_code/currency_code.
-- Motivo: produto vendido via Hotmart (conversão de moeda é do gateway, não
-- nossa) — não há razão para limitar o quiz a 4 países. Países sem preço
-- local dedicado caem no tier 'OTHER' (preço em USD).
--
-- IMPORTANTE: Postgres não permite usar um valor de enum recém-criado na
-- MESMA transação em que foi adicionado (ALTER TYPE ... ADD VALUE). Por isso
-- este arquivo SÓ adiciona os valores. Rode 0017 em uma execução SEPARADA
-- no SQL Editor do Supabase (depois que este aqui já tiver sido confirmado).
-- =============================================================================

ALTER TYPE country_code ADD VALUE IF NOT EXISTS 'OTHER';
ALTER TYPE currency_code ADD VALUE IF NOT EXISTS 'USD';

-- =============================================================================
-- FIM 0016_expand_countries_enum
-- =============================================================================
