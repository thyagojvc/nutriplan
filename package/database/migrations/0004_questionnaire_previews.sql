-- =============================================================================
-- NUTRIPLAN — MIGRATION 0004_questionnaire_previews
-- Base: Spec Tecnica Fase 1 + Adendos v1.1, v1.2, v1.3
-- Escopo: tabelas questionnaire_answers e previews.
-- Ordem canonica (v1.2 T1): etapas 8 (questionnaire_answers) e 9 (previews).
-- Depende de: 0001 (enums), 0003 (generation_sessions, leads).
--
-- CONFIRMACOES desta migration:
--  - questionnaire_answers.answers_json NOT NULL.
--  - health_conditions e physical_limitations com default explicito '{none}'.
--  - previews contem APENAS metricas e estrutura; SEM qualquer conteudo
--    alimentar real (Decisao 9-R).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- questionnaire_answers
-- Colunas estruturadas para regras de negocio + answers_json (payload completo).
-- Idade minima 18 (F1); faixas de peso e altura conforme v8.
-- -----------------------------------------------------------------------------
create table questionnaire_answers (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references generation_sessions(id) on delete cascade,
  lead_id              uuid references leads(id) on delete set null,

  -- dados estruturados
  sex                  sex_biological not null,
  age                  int not null check (age >= 18 and age <= 80),
  weight_kg            numeric(5,1) not null check (weight_kg >= 40 and weight_kg <= 250),
  height_cm            numeric(5,1) not null check (height_cm >= 130 and height_cm <= 220),
  goal                 goal_type not null,
  activity             activity_level not null,
  country              country_code not null,

  -- saude (F2) e limitacoes musculoesqueleticas (Decisao 6), default explicito {none}
  health_conditions    health_condition[] not null default '{none}',
  physical_limitations physical_limitation[] not null default '{none}',

  -- treino
  training_experience  training_experience,
  training_location    training_location,
  training_frequency   int check (training_frequency between 2 and 5),

  -- payload completo: favoritos, inegociavel, restricoes, obstaculo, textos,
  -- goal_original (auditoria de sobreposicao clinica), etc.
  answers_json         jsonb not null,

  created_at           timestamptz not null default now()
);

comment on table questionnaire_answers is 'Respostas do questionario (12 etapas). Dados estruturados para regras + answers_json completo. answers_json NOT NULL.';
comment on column questionnaire_answers.health_conditions is 'Etapa 9 (F2). Default {none}. Alimenta Motor Nutricional e Motor de Treino.';
comment on column questionnaire_answers.physical_limitations is 'Etapa 10 (Decisao 6). Default {none}. Alimenta o Motor de Treino.';

create index idx_qa_session on questionnaire_answers(session_id);
create index idx_qa_lead on questionnaire_answers(lead_id);
create index idx_qa_answers_gin on questionnaire_answers using gin (answers_json);

-- -----------------------------------------------------------------------------
-- previews (Decisao 9-R)
-- Apenas metricas calculadas e estrutura com placeholders.
-- PROIBIDO qualquer alimento real: nenhuma coluna de alimentos, nenhuma
-- refeicao real. metrics_json guarda indicadores e estrutura (placeholders).
-- -----------------------------------------------------------------------------
create table previews (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references generation_sessions(id) on delete cascade,
  bmr          numeric(7,1) not null,            -- TMB
  tdee         numeric(7,1) not null,            -- GET
  target_kcal  numeric(7,1) not null,
  protein_g    numeric(6,1) not null,
  meals_count  int not null check (meals_count between 1 and 8),
  metrics_json jsonb not null,                   -- indicadores + estrutura com placeholders (sem alimentos reais)
  created_at   timestamptz not null default now()
);

comment on table previews is 'Previa determinista (Decisao 9-R): apenas metricas e estrutura com placeholders. PROIBIDO conteudo alimentar real.';
comment on column previews.metrics_json is 'Indicadores de personalizacao e estrutura das refeicoes em placeholders. Nunca alimentos reais.';

create index idx_previews_session on previews(session_id);

-- =============================================================================
-- FIM 0004_questionnaire_previews
-- =============================================================================
