-- =============================================================================
-- NUTRIPLAN — MIGRATION 0015_add_hotmart_provider
-- Adiciona 'hotmart' ao enum payment_provider.
-- Hotmart substituiu Stripe + Mercado Pago como gateway de pagamento para MVP.
-- =============================================================================

ALTER TYPE payment_provider ADD VALUE IF NOT EXISTS 'hotmart';

-- =============================================================================
-- FIM 0015_add_hotmart_provider
-- =============================================================================
