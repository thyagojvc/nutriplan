-- =============================================================================
-- NUTRIPLAN — MIGRATION 0019_orders_fb_tracking
-- Escopo: colunas para alimentar o evento Purchase via Meta Conversions API
--   (CAPI) a partir do webhook da Hotmart, que é server-to-server e não tem
--   acesso aos cookies do pixel no navegador.
--   - fbc / fbp: cookies do Meta Pixel, capturados no momento da criação do
--     pedido (antes do redirect para a Hotmart), usados para melhorar o
--     match quality e a atribuição do evento Purchase.
--   - client_ip_address / client_user_agent: contexto do navegador na hora
--     da criação do pedido, exigido pela CAPI para validar o evento.
-- Depende de: 0005 (orders).
-- =============================================================================

alter table orders
  add column if not exists fbc text,
  add column if not exists fbp text,
  add column if not exists client_ip_address text,
  add column if not exists client_user_agent text;

comment on column orders.fbc is
  'Cookie _fbc do Meta Pixel no momento da criação do pedido (clique em anúncio). Usado na Conversions API para atribuir o Purchase.';
comment on column orders.fbp is
  'Cookie _fbp do Meta Pixel no momento da criação do pedido. Usado na Conversions API para melhorar o match quality.';
comment on column orders.client_ip_address is
  'IP do navegador na criação do pedido. Exigido pela Conversions API (action_source=website).';
comment on column orders.client_user_agent is
  'User-Agent do navegador na criação do pedido. Exigido pela Conversions API (action_source=website).';

-- =============================================================================
-- FIM 0019_orders_fb_tracking
-- =============================================================================
