-- ============================================
-- ElegeHub CRM - Database Schema
-- Migration: 001-create-tables
-- Description: Creates all dimension and fact tables for electoral data
-- ============================================

-- ============================================
-- DIMENSION TABLES
-- ============================================

-- Estados brasileiros
CREATE TABLE IF NOT EXISTS dim_estados (
  id SERIAL PRIMARY KEY,
  codigo_uf CHAR(2) NOT NULL UNIQUE,
  nome VARCHAR(50) NOT NULL,
  codigo_ibge INTEGER NOT NULL UNIQUE,
  regiao VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE dim_estados IS 'Estados brasileiros com codigos IBGE';
COMMENT ON COLUMN dim_estados.codigo_uf IS 'Sigla do estado (MG, SP, RJ)';
COMMENT ON COLUMN dim_estados.regiao IS 'Regiao geografica (Sudeste, Sul, Norte, Nordeste, Centro-Oeste)';

-- Regioes de MG (mesorregioes IBGE mapeadas para nomes amigaveis)
CREATE TABLE IF NOT EXISTS dim_regioes_mg (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(50) NOT NULL UNIQUE,
  codigo_mesorregiao INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE dim_regioes_mg IS 'Mesorregioes de Minas Gerais com nomes amigaveis';

-- Municipios brasileiros
CREATE TABLE IF NOT EXISTS dim_municipios (
  id SERIAL PRIMARY KEY,
  codigo_ibge VARCHAR(7) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  estado_id INTEGER NOT NULL REFERENCES dim_estados(id),
  regiao_mg_id INTEGER REFERENCES dim_regioes_mg(id),
  populacao INTEGER,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  area_km2 DECIMAL(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE dim_municipios IS 'Municipios brasileiros com dados geograficos e demograficos';
COMMENT ON COLUMN dim_municipios.codigo_ibge IS 'Codigo IBGE de 7 digitos';
COMMENT ON COLUMN dim_municipios.regiao_mg_id IS 'Regiao de MG (NULL para outros estados)';

CREATE INDEX IF NOT EXISTS idx_municipios_estado ON dim_municipios(estado_id);
CREATE INDEX IF NOT EXISTS idx_municipios_regiao ON dim_municipios(regiao_mg_id);

-- Partidos politicos
CREATE TABLE IF NOT EXISTS dim_partidos (
  id SERIAL PRIMARY KEY,
  sigla VARCHAR(20) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  numero INTEGER NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE dim_partidos IS 'Partidos politicos registrados no TSE';

-- Candidatos (historico de todas eleicoes)
CREATE TABLE IF NOT EXISTS dim_candidatos (
  id SERIAL PRIMARY KEY,
  id_candidato_bd VARCHAR(50),
  sq_candidato VARCHAR(20) NOT NULL,
  nome VARCHAR(200) NOT NULL,
  nome_urna VARCHAR(100),
  cpf VARCHAR(11),
  partido_id INTEGER REFERENCES dim_partidos(id),
  estado_id INTEGER REFERENCES dim_estados(id),
  data_nascimento DATE,
  genero CHAR(1),
  profissao VARCHAR(200),
  escolaridade VARCHAR(100),
  email VARCHAR(200),
  foto_url TEXT,
  ano_eleicao INTEGER NOT NULL,
  cargo VARCHAR(50) NOT NULL,
  numero_candidato INTEGER,
  situacao_candidatura VARCHAR(50),
  resultado VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sq_candidato, ano_eleicao)
);

COMMENT ON TABLE dim_candidatos IS 'Candidatos de todas as eleicoes';
COMMENT ON COLUMN dim_candidatos.id_candidato_bd IS 'ID da Base dos Dados (para joins)';
COMMENT ON COLUMN dim_candidatos.sq_candidato IS 'Sequencial do candidato no TSE';
COMMENT ON COLUMN dim_candidatos.cargo IS 'DEPUTADO ESTADUAL, DEPUTADO FEDERAL, SENADOR, GOVERNADOR, PRESIDENTE';
COMMENT ON COLUMN dim_candidatos.resultado IS 'ELEITO, NAO ELEITO, SUPLENTE, 2O TURNO';

CREATE INDEX IF NOT EXISTS idx_candidatos_ano ON dim_candidatos(ano_eleicao);
CREATE INDEX IF NOT EXISTS idx_candidatos_cargo ON dim_candidatos(cargo);
CREATE INDEX IF NOT EXISTS idx_candidatos_estado ON dim_candidatos(estado_id);
CREATE INDEX IF NOT EXISTS idx_candidatos_partido ON dim_candidatos(partido_id);
CREATE INDEX IF NOT EXISTS idx_candidatos_bd ON dim_candidatos(id_candidato_bd);

-- ============================================
-- FACT TABLES
-- ============================================

-- Votacao por candidato por municipio
CREATE TABLE IF NOT EXISTS fact_votacao (
  id SERIAL PRIMARY KEY,
  candidato_id INTEGER NOT NULL REFERENCES dim_candidatos(id),
  municipio_id INTEGER NOT NULL REFERENCES dim_municipios(id),
  ano_eleicao INTEGER NOT NULL,
  turno INTEGER NOT NULL DEFAULT 1,
  votos INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(candidato_id, municipio_id, ano_eleicao, turno)
);

COMMENT ON TABLE fact_votacao IS 'Votos por candidato por municipio';

CREATE INDEX IF NOT EXISTS idx_votacao_ano ON fact_votacao(ano_eleicao);
CREATE INDEX IF NOT EXISTS idx_votacao_municipio ON fact_votacao(municipio_id);
CREATE INDEX IF NOT EXISTS idx_votacao_candidato ON fact_votacao(candidato_id);

-- Gastos de campanha por candidato
CREATE TABLE IF NOT EXISTS fact_gastos (
  id SERIAL PRIMARY KEY,
  candidato_id INTEGER NOT NULL REFERENCES dim_candidatos(id),
  ano_eleicao INTEGER NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  descricao TEXT,
  valor DECIMAL(15, 2) NOT NULL,
  data_despesa DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE fact_gastos IS 'Despesas de campanha por candidato';
COMMENT ON COLUMN fact_gastos.categoria IS 'pessoal, midia, eventos, material_grafico, transporte, outros';

CREATE INDEX IF NOT EXISTS idx_gastos_candidato ON fact_gastos(candidato_id);
CREATE INDEX IF NOT EXISTS idx_gastos_ano ON fact_gastos(ano_eleicao);
CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON fact_gastos(categoria);

-- Perfil do eleitorado por municipio (agregado)
CREATE TABLE IF NOT EXISTS fact_eleitorado_perfil (
  id SERIAL PRIMARY KEY,
  municipio_id INTEGER NOT NULL REFERENCES dim_municipios(id),
  ano INTEGER NOT NULL,
  total_eleitores INTEGER NOT NULL,
  faixa_16_17 INTEGER DEFAULT 0,
  faixa_18_24 INTEGER DEFAULT 0,
  faixa_25_34 INTEGER DEFAULT 0,
  faixa_35_44 INTEGER DEFAULT 0,
  faixa_45_59 INTEGER DEFAULT 0,
  faixa_60_mais INTEGER DEFAULT 0,
  genero_masculino INTEGER DEFAULT 0,
  genero_feminino INTEGER DEFAULT 0,
  escolaridade_fundamental INTEGER DEFAULT 0,
  escolaridade_medio INTEGER DEFAULT 0,
  escolaridade_superior INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(municipio_id, ano)
);

COMMENT ON TABLE fact_eleitorado_perfil IS 'Perfil demografico do eleitorado por municipio';

CREATE INDEX IF NOT EXISTS idx_eleitorado_municipio ON fact_eleitorado_perfil(municipio_id);
CREATE INDEX IF NOT EXISTS idx_eleitorado_ano ON fact_eleitorado_perfil(ano);

-- ============================================
-- VIEWS
-- ============================================

-- View: Municipios com dados completos
CREATE OR REPLACE VIEW view_municipios_completo AS
SELECT
  m.id,
  m.codigo_ibge,
  m.nome,
  m.populacao,
  m.latitude,
  m.longitude,
  m.area_km2,
  e.codigo_uf,
  e.nome AS estado_nome,
  e.regiao AS estado_regiao,
  r.nome AS regiao_mg_nome,
  r.codigo_mesorregiao
FROM dim_municipios m
JOIN dim_estados e ON m.estado_id = e.id
LEFT JOIN dim_regioes_mg r ON m.regiao_mg_id = r.id;

-- View: Candidatos com dados completos
CREATE OR REPLACE VIEW view_candidatos_completo AS
SELECT
  c.id,
  c.id_candidato_bd,
  c.sq_candidato,
  c.nome,
  c.nome_urna,
  c.ano_eleicao,
  c.cargo,
  c.numero_candidato,
  c.data_nascimento,
  EXTRACT(YEAR FROM AGE(c.data_nascimento))::INTEGER AS idade,
  c.genero,
  c.profissao,
  c.escolaridade,
  c.foto_url,
  c.situacao_candidatura,
  c.resultado,
  p.sigla AS partido_sigla,
  p.nome AS partido_nome,
  p.numero AS partido_numero,
  e.codigo_uf,
  e.nome AS estado_nome,
  COALESCE(v.total_votos, 0) AS total_votos,
  COALESCE(g.total_gastos, 0) AS total_gastos,
  CASE
    WHEN COALESCE(v.total_votos, 0) > 0
    THEN ROUND(COALESCE(g.total_gastos, 0) / v.total_votos, 2)
    ELSE 0
  END AS custo_por_voto
FROM dim_candidatos c
LEFT JOIN dim_partidos p ON c.partido_id = p.id
LEFT JOIN dim_estados e ON c.estado_id = e.id
LEFT JOIN (
  SELECT candidato_id, SUM(votos) AS total_votos
  FROM fact_votacao
  GROUP BY candidato_id
) v ON v.candidato_id = c.id
LEFT JOIN (
  SELECT candidato_id, SUM(valor) AS total_gastos
  FROM fact_gastos
  GROUP BY candidato_id
) g ON g.candidato_id = c.id;

-- View: Votos agregados por municipio (para mapa estrategico)
CREATE OR REPLACE VIEW view_votos_por_municipio AS
SELECT
  m.id AS municipio_id,
  m.codigo_ibge,
  m.nome AS municipio_nome,
  e.codigo_uf,
  v.ano_eleicao,
  v.turno,
  c.cargo,
  SUM(v.votos) AS total_votos,
  COUNT(DISTINCT v.candidato_id) AS total_candidatos
FROM fact_votacao v
JOIN dim_municipios m ON v.municipio_id = m.id
JOIN dim_estados e ON m.estado_id = e.id
JOIN dim_candidatos c ON v.candidato_id = c.id
GROUP BY m.id, m.codigo_ibge, m.nome, e.codigo_uf, v.ano_eleicao, v.turno, c.cargo;

-- View: Gastos agregados por categoria
CREATE OR REPLACE VIEW view_gastos_por_categoria AS
SELECT
  c.id AS candidato_id,
  c.nome AS candidato_nome,
  c.ano_eleicao,
  g.categoria,
  SUM(g.valor) AS total_categoria,
  ROUND(
    SUM(g.valor) * 100.0 / NULLIF(SUM(SUM(g.valor)) OVER (PARTITION BY c.id), 0),
    2
  ) AS percentual
FROM fact_gastos g
JOIN dim_candidatos c ON g.candidato_id = c.id
GROUP BY c.id, c.nome, c.ano_eleicao, g.categoria;

-- ============================================
-- SEED DATA: Regioes de MG
-- ============================================

INSERT INTO dim_regioes_mg (nome, codigo_mesorregiao) VALUES
  ('Central Mineira', 3107),
  ('Jequitinhonha', 3108),
  ('Metropolitana de Belo Horizonte', 3106),
  ('Noroeste de Minas', 3101),
  ('Norte de Minas', 3102),
  ('Oeste de Minas', 3105),
  ('Sul/Sudoeste de Minas', 3110),
  ('Triangulo Mineiro/Alto Paranaiba', 3103),
  ('Vale do Mucuri', 3109),
  ('Vale do Rio Doce', 3104),
  ('Zona da Mata', 3111),
  ('Campo das Vertentes', 3112)
ON CONFLICT (nome) DO NOTHING;

-- ============================================
-- TRIGGERS: Updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dim_estados_updated_at
  BEFORE UPDATE ON dim_estados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dim_municipios_updated_at
  BEFORE UPDATE ON dim_municipios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dim_candidatos_updated_at
  BEFORE UPDATE ON dim_candidatos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
