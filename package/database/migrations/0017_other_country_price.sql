-- =============================================================================
-- NUTRIPLAN — MIGRATION 0017_other_country_price
-- RODAR DEPOIS de 0016 ter sido executado e confirmado (execução separada).
--
-- 1. Atualiza chk_price_country_currency para aceitar ('OTHER','USD').
-- 2. Insere preço PLAN_STANDARD/TRAINING_BUMP para o tier 'OTHER' (USD),
--    usado por qualquer país fora de MX/CO/CL/ES selecionado no quiz.
-- =============================================================================

ALTER TABLE price_book DROP CONSTRAINT chk_price_country_currency;

ALTER TABLE price_book ADD CONSTRAINT chk_price_country_currency CHECK (
  (country = 'MX' and currency = 'MXN') or
  (country = 'CO' and currency = 'COP') or
  (country = 'CL' and currency = 'CLP') or
  (country = 'ES' and currency = 'EUR') or
  (country = 'OTHER' and currency = 'USD')
);

WITH admin AS (
  SELECT id FROM admin_users WHERE email = 'thyago@gmail.com'
)
INSERT INTO price_book
  (product_code, country, currency, local_price, base_price_usd,
   period_version, status, effective_from, created_by_admin_id)
SELECT * FROM (VALUES
  ('PLAN_STANDARD'::product_code, 'OTHER'::country_code, 'USD'::currency_code,
   9.90, 9.90, '2026-06', 'active'::price_status, now()),
  ('TRAINING_BUMP'::product_code,  'OTHER'::country_code, 'USD'::currency_code,
   4.90, 4.90, '2026-06', 'active'::price_status, now())
) AS v(product_code, country, currency, local_price, base_price_usd,
       period_version, status, effective_from),
admin
ON CONFLICT DO NOTHING;

-- Verificação
SELECT product_code, country, currency, local_price FROM price_book WHERE country = 'OTHER';

-- =============================================================================
-- FIM 0017_other_country_price
-- =============================================================================
