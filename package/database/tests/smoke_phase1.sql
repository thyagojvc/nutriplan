-- =============================================================================
-- NUTRIPLAN — SMOKE TEST DA FASE 1
-- Uso:  psql -d <banco_com_migrations_aplicadas> -f tests/smoke_phase1.sql
-- Saida: levanta exception no primeiro assert que falhar; ao final imprime
--        'SMOKE TEST PHASE 1: PASSED'.
-- Nao deixa residuo: roda em transacao com rollback e dados isolados por prefixo.
-- Requisitos: migrations 0001..0012 aplicadas; schema auth com auth.uid()/auth.role()
--             (no Supabase ja existem; em banco local, crie stubs antes).
-- =============================================================================

\set ON_ERROR_STOP on
\timing off

begin;

-- helper de assert
create or replace function pg_temp.assert(cond boolean, msg text)
returns void language plpgsql as $$
begin
  if not cond then raise exception 'ASSERT FALHOU: %', msg; end if;
end $$;

-- captura: helper que executa SQL e diz se levantou erro
create or replace function pg_temp.raised(sql text) returns boolean
language plpgsql as $$
begin
  execute sql;
  return false;   -- nao levantou
exception when others then
  return true;    -- levantou (esperado nos testes negativos)
end $$;

-- IDs de teste (prefixo fixo para isolar)
-- admin superadmin, admin support, user A, user B, lead, session, order
-- -----------------------------------------------------------------------------
-- SEED de teste
-- -----------------------------------------------------------------------------
insert into admin_users(id,auth_user_id,email,role) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1','ffffffff-0000-0000-0000-0000000000f1','smoke_super@test','superadmin'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2','ffffffff-0000-0000-0000-0000000000f6','smoke_support@test','support');

insert into users(id,auth_user_id,email,name,country) values
  ('22222222-0000-0000-0000-000000000001','ffffffff-0000-0000-0000-0000000000f2','smoke_a@test','User A','MX'),
  ('22222222-0000-0000-0000-000000000002','ffffffff-0000-0000-0000-0000000000f5','smoke_b@test','User B','CL');

insert into leads(id,email,name,country) values
  ('33333333-0000-0000-0000-000000000001','smoke_a@test','User A','MX');

insert into generation_sessions(id,lead_id,user_id,country) values
  ('44444444-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','MX');

insert into price_book(product_code,country,currency,local_price,base_price_usd,period_version,effective_from,created_by_admin_id)
  values ('PLAN_STANDARD','MX','MXN',199.00,9.90,'smoke','2026-06-01','aaaaaaaa-0000-0000-0000-0000000000a1');

-- =============================================================================
-- 1. CRIACAO DE PEDIDO + ITENS
-- =============================================================================
insert into orders(id,user_id,status,country,currency,total_amount,provider,price_book_period_version,idempotency_key)
  values ('11111111-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','pending','MX','MXN',248.00,'mercado_pago','smoke','smoke-idem-1');
insert into order_items(order_id,kind,product_code,unit_price,currency)
  values ('11111111-0000-0000-0000-000000000001','nutrition','PLAN_STANDARD',199.00,'MXN');
insert into order_items(order_id,kind,product_code,unit_price,currency)
  values ('11111111-0000-0000-0000-000000000001','training','TRAINING_BUMP',49.00,'MXN');
select pg_temp.assert((select count(*) from order_items where order_id='11111111-0000-0000-0000-000000000001')=2, 'pedido deve ter 2 itens');

-- =============================================================================
-- 2. UNIQUE idempotency_key
-- =============================================================================
select pg_temp.assert(pg_temp.raised(
  $q$ insert into orders(user_id,status,country,currency,total_amount,provider,price_book_period_version,idempotency_key)
      values ('22222222-0000-0000-0000-000000000001','pending','MX','MXN',1,'mercado_pago','smoke','smoke-idem-1') $q$),
  'idempotency_key duplicada deveria falhar');

-- =============================================================================
-- 3. UNIQUE parcial provider_payment_id (multiplos NULL permitidos; duplicado nao)
-- =============================================================================
update orders set provider_payment_id='pay_smoke_1' where id='11111111-0000-0000-0000-000000000001';
insert into orders(id,user_id,status,country,currency,total_amount,provider,provider_payment_id,price_book_period_version,idempotency_key)
  values ('11111111-0000-0000-0000-000000000009','22222222-0000-0000-0000-000000000001','pending','MX','MXN',199,'mercado_pago',null,'smoke','smoke-idem-9');
-- segundo NULL permitido:
insert into orders(id,user_id,status,country,currency,total_amount,provider,provider_payment_id,price_book_period_version,idempotency_key)
  values ('11111111-0000-0000-0000-000000000010','22222222-0000-0000-0000-000000000001','pending','MX','MXN',199,'mercado_pago',null,'smoke','smoke-idem-10');
select pg_temp.assert(pg_temp.raised(
  $q$ update orders set provider_payment_id='pay_smoke_1' where id='11111111-0000-0000-0000-000000000009' $q$),
  'provider_payment_id duplicado (mesmo provider) deveria falhar');

-- =============================================================================
-- 4. UNIQUE item nutricional unico por pedido
-- =============================================================================
select pg_temp.assert(pg_temp.raised(
  $q$ insert into order_items(order_id,kind,product_code,unit_price,currency)
      values ('11111111-0000-0000-0000-000000000001','nutrition','PLAN_STANDARD',1,'MXN') $q$),
  'segundo item nutrition no mesmo pedido deveria falhar');

-- =============================================================================
-- 5. IMUTABILIDADE orders
-- =============================================================================
select pg_temp.assert(pg_temp.raised(
  $q$ update orders set total_amount=999 where id='11111111-0000-0000-0000-000000000001' $q$),
  'alterar total_amount deveria falhar');
select pg_temp.assert(pg_temp.raised(
  $q$ update orders set price_book_period_version='x' where id='11111111-0000-0000-0000-000000000001' $q$),
  'alterar price_book_period_version deveria falhar');
-- transicao de status permitida:
update orders set status='paid', paid_at=now() where id='11111111-0000-0000-0000-000000000001';
select pg_temp.assert((select status from orders where id='11111111-0000-0000-0000-000000000001')='paid','status deveria virar paid');

-- =============================================================================
-- 6. IMUTABILIDADE order_items
-- =============================================================================
select pg_temp.assert(pg_temp.raised(
  $q$ update order_items set unit_price=1 where order_id='11111111-0000-0000-0000-000000000001' and kind='nutrition' $q$),
  'alterar unit_price deveria falhar');

-- =============================================================================
-- 7. OVERLAP price_book + check pais/moeda
-- =============================================================================
select pg_temp.assert(pg_temp.raised(
  $q$ insert into price_book(product_code,country,currency,local_price,base_price_usd,period_version,effective_from,created_by_admin_id)
      values ('PLAN_STANDARD','MX','MXN',210,9.90,'smoke2','2026-06-15','aaaaaaaa-0000-0000-0000-0000000000a1') $q$),
  'preco sobreposto deveria falhar (overlap/uq_price_current)');
select pg_temp.assert(pg_temp.raised(
  $q$ insert into price_book(product_code,country,currency,local_price,base_price_usd,period_version,effective_from,created_by_admin_id)
      values ('TRAINING_BUMP','MX','EUR',99,4.90,'smoke3','2026-06-01','aaaaaaaa-0000-0000-0000-0000000000a1') $q$),
  'moeda inconsistente com pais deveria falhar');

-- =============================================================================
-- 8. DEDUP webhook
-- =============================================================================
insert into webhook_logs(provider,provider_event_id,payload_json) values ('stripe','evt_smoke','{}');
select pg_temp.assert(pg_temp.raised(
  $q$ insert into webhook_logs(provider,provider_event_id,payload_json) values ('stripe','evt_smoke','{}') $q$),
  'webhook duplicado deveria falhar');

-- =============================================================================
-- 9. APPEND-ONLY consent_records
-- =============================================================================
insert into consent_records(subject_kind,user_id,policy_version,consent_text,ip_address,country)
  values ('user','22222222-0000-0000-0000-000000000001','v1','t','1.2.3.4','MX');
select pg_temp.assert(pg_temp.raised(
  $q$ update consent_records set policy_version='v2' where user_id='22222222-0000-0000-0000-000000000001' $q$),
  'update em consent_records deveria falhar');
select pg_temp.assert(pg_temp.raised(
  $q$ delete from consent_records where user_id='22222222-0000-0000-0000-000000000001' $q$),
  'delete em consent_records deveria falhar');
select pg_temp.assert(pg_temp.raised(
  $q$ insert into consent_records(subject_kind,policy_version,consent_text,ip_address,country)
      values ('user','v1','t','1.2.3.4','MX') $q$),
  'consent sem sujeito deveria falhar (chk_consent_subject_ref)');

-- =============================================================================
-- 10. APPEND-ONLY admin_audit_log
-- =============================================================================
insert into admin_audit_log(actor_admin_id,action) values ('aaaaaaaa-0000-0000-0000-0000000000a1','smoke.test');
select pg_temp.assert(pg_temp.raised(
  $q$ update admin_audit_log set action='x' where action='smoke.test' $q$),
  'update em admin_audit_log deveria falhar');
select pg_temp.assert(pg_temp.raised(
  $q$ delete from admin_audit_log where action='smoke.test' $q$),
  'delete em admin_audit_log deveria falhar');

-- =============================================================================
-- 11. UNIQUE(order_id, kind) generated_documents + substituicao
-- =============================================================================
insert into generated_documents(user_id,order_id,kind,storage_path,file_name,checksum)
  values ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','nutrition_plan','/p/np.pdf','np.pdf','h1');
select pg_temp.assert(pg_temp.raised(
  $q$ insert into generated_documents(user_id,order_id,kind,storage_path,file_name,checksum)
      values ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','nutrition_plan','/p/x.pdf','x.pdf','h2') $q$),
  'documento duplicado (order_id,kind) deveria falhar');
-- substituicao via delete+insert deve passar:
delete from generated_documents where order_id='11111111-0000-0000-0000-000000000001' and kind='nutrition_plan';
insert into generated_documents(user_id,order_id,kind,storage_path,file_name,checksum)
  values ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','nutrition_plan','/p/np2.pdf','np2.pdf','h3');

-- =============================================================================
-- 12-16. RLS (usuario, support, superadmin, analytics particionado)
-- =============================================================================
insert into analytics_events(event_name,user_id) values ('smoke_evt','22222222-0000-0000-0000-000000000001');

-- precisa de roles do Supabase; cria se ausentes (idempotente)
do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;

-- 12. RLS usuario A ve so o proprio pedido
set local role authenticated;
select set_config('request.jwt.claim.sub','ffffffff-0000-0000-0000-0000000000f2', true);
select set_config('request.jwt.claim.role','authenticated', true);
select pg_temp.assert((select count(*) from orders)=3, 'usuario A deveria ver seus 3 pedidos de teste');
select pg_temp.assert((select count(*) from orders where user_id='22222222-0000-0000-0000-000000000002')=0, 'usuario A nao deveria ver pedido de B');
select pg_temp.assert((select count(*) from analytics_events)=0, 'cliente nao deveria ver analytics');
reset role;

-- 13. RLS usuario B nao ve pedidos de A
set local role authenticated;
select set_config('request.jwt.claim.sub','ffffffff-0000-0000-0000-0000000000f5', true);
select pg_temp.assert((select count(*) from orders)=0, 'usuario B nao deveria ver pedidos de A');
reset role;

-- 14. RLS support: ve orders, nao ve consent nem analytics
set local role authenticated;
select set_config('request.jwt.claim.sub','ffffffff-0000-0000-0000-0000000000f6', true);
select pg_temp.assert(has_admin_role('support'), 'support deveria ter papel support');
select pg_temp.assert(not has_admin_role('superadmin'), 'support nao deveria ser superadmin');
select pg_temp.assert((select count(*) from orders)=3, 'support deveria ver orders');
select pg_temp.assert((select count(*) from consent_records)=0, 'support NAO deveria ver consent');
select pg_temp.assert((select count(*) from analytics_events)=0, 'support NAO deveria ver analytics');
reset role;

-- 15. RLS superadmin: ve tudo
set local role authenticated;
select set_config('request.jwt.claim.sub','ffffffff-0000-0000-0000-0000000000f1', true);
select pg_temp.assert(is_active_admin(), 'superadmin deveria ser admin ativo');
select pg_temp.assert((select count(*) from orders)=3, 'superadmin deveria ver orders');
select pg_temp.assert((select count(*) from consent_records)=1, 'superadmin deveria ver consent');
select pg_temp.assert((select count(*) from analytics_events)=1, 'superadmin deveria ver analytics');
reset role;

-- 16. analytics particionado: evento foi para a particiao correta (roteamento por data)
select pg_temp.assert((select count(*) from analytics_events where event_name='smoke_evt')=1, 'evento deveria estar acessivel (particao + default)');

\echo '============================================================'
\echo 'SMOKE TEST PHASE 1: PASSED'
\echo '============================================================'

rollback;  -- nao deixa residuo
