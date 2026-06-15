-- =============================================================================
-- NUTRIPLAN — MIGRATION 0014_grant_seed_fase_b
-- Escopo: GRANT ao service_role + seed admin_users + seed price_book (Fase B)
-- RODAR NO SQL EDITOR DO SUPABASE (uma única vez)
-- Idempotente: usa INSERT ... ON CONFLICT DO NOTHING
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. GRANT para service_role em todas as tabelas e sequences públicas
-- Necessário porque as migrations foram criadas via SQL Editor (não via CLI),
-- portanto os grants automáticos do Supabase não foram aplicados.
-- -----------------------------------------------------------------------------
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO service_role;

-- -----------------------------------------------------------------------------
-- 2. Admin user: thyago@gmail.com como superadmin
-- auth_user_id = UUID do usuário no Supabase Auth (já existe em auth.users)
-- -----------------------------------------------------------------------------
INSERT INTO admin_users (auth_user_id, email, role, active)
VALUES (
  'aa3e69de-7259-474e-944d-89b76a2a2a4e',
  'thyago@gmail.com',
  'superadmin',
  true
)
ON CONFLICT (email) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Price book — 4 países × 2 produtos
-- Usa CTE para capturar o admin_id recém-inserido (ou existente)
-- Preços definidos para lançamento MVP 2026-06
-- -----------------------------------------------------------------------------
WITH admin AS (
  SELECT id FROM admin_users WHERE email = 'thyago@gmail.com'
)
INSERT INTO price_book
  (product_code, country, currency, local_price, base_price_usd,
   period_version, status, effective_from, created_by_admin_id)
SELECT * FROM (VALUES
  -- México (MXN)
  ('PLAN_STANDARD'::product_code, 'MX'::country_code, 'MXN'::currency_code,
   199.00, 9.90, '2026-06', 'active'::price_status, now()),
  ('TRAINING_BUMP'::product_code,  'MX'::country_code, 'MXN'::currency_code,
   99.00,  4.90, '2026-06', 'active'::price_status, now()),

  -- Colombia (COP)
  ('PLAN_STANDARD'::product_code, 'CO'::country_code, 'COP'::currency_code,
   39900.00, 9.90, '2026-06', 'active'::price_status, now()),
  ('TRAINING_BUMP'::product_code,  'CO'::country_code, 'COP'::currency_code,
   19900.00, 4.90, '2026-06', 'active'::price_status, now()),

  -- Chile (CLP)
  ('PLAN_STANDARD'::product_code, 'CL'::country_code, 'CLP'::currency_code,
   9990.00, 9.90, '2026-06', 'active'::price_status, now()),
  ('TRAINING_BUMP'::product_code,  'CL'::country_code, 'CLP'::currency_code,
   4990.00, 4.90, '2026-06', 'active'::price_status, now()),

  -- España (EUR)
  ('PLAN_STANDARD'::product_code, 'ES'::country_code, 'EUR'::currency_code,
   9.99,  9.90, '2026-06', 'active'::price_status, now()),
  ('TRAINING_BUMP'::product_code,  'ES'::country_code, 'EUR'::currency_code,
   4.99,  4.90, '2026-06', 'active'::price_status, now())
) AS v(product_code, country, currency, local_price, base_price_usd,
       period_version, status, effective_from),
admin
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Verificação (retorna o que foi inserido)
-- -----------------------------------------------------------------------------
SELECT 'admin_users' AS tabela, count(*) FROM admin_users
UNION ALL
SELECT 'price_book',            count(*) FROM price_book;

-- =============================================================================
-- FIM 0014_grant_seed_fase_b
-- =============================================================================
