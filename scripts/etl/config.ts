/**
 * ETL Configuration
 * URLs and settings for IBGE APIs and Base dos Dados BigQuery
 */

// ============================================
// IBGE API Configuration
// ============================================

export const IBGE_CONFIG = {
  // API de Localidades
  LOCALIDADES: {
    ESTADOS: 'https://servicodados.ibge.gov.br/api/v1/localidades/estados',
    MUNICIPIOS_POR_UF: (uf: string) =>
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
    MUNICIPIO_POR_ID: (id: string) =>
      `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${id}`,
  },

  // API de Malhas Geograficas
  MALHAS: {
    ESTADO_GEOJSON: (uf: string) =>
      `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${uf}?formato=application/vnd.geo+json`,
    MUNICIPIOS_DO_ESTADO: (uf: string) =>
      `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${uf}?formato=application/vnd.geo+json&resolucao=5`,
  },

  // API SIDRA (Dados Agregados)
  SIDRA: {
    // Populacao do Censo 2022
    POPULACAO_CENSO_2022: 'https://apisidra.ibge.gov.br/values/t/9514/n6/all/v/93/p/2022',
    // Estimativas de populacao (atualizadas anualmente)
    ESTIMATIVAS_POPULACAO: 'https://apisidra.ibge.gov.br/values/t/6579/n6/all/v/all/p/last',
  },

  // Timeout para requests (ms)
  TIMEOUT: 30000,
}

// ============================================
// Base dos Dados (BigQuery) Configuration
// ============================================

export const BASEDOSDADOS_CONFIG = {
  // Projeto do usuario para criar jobs (usar projeto pessoal, nao o publico)
  USER_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT || 'elegehub-crm-496319',

  // Projeto publico do BigQuery (apenas para referencia de tabelas)
  PUBLIC_PROJECT: 'basedosdados',

  // Dataset de eleicoes
  DATASET: 'br_tse_eleicoes',

  // Tabelas disponiveis
  TABLES: {
    CANDIDATOS: 'candidatos',
    VOTOS_CANDIDATO_MUNICIPIO: 'votacao_candidato_municipio',
    DESPESAS: 'despesas_candidato',
    PARTIDOS: 'partidos',
    RESULTADOS: 'resultados_candidato',
  },

  // Full qualified table names
  FQN: {
    CANDIDATOS: 'basedosdados.br_tse_eleicoes.candidatos',
    VOTOS: 'basedosdados.br_tse_eleicoes.resultados_candidato_municipio',
    DESPESAS: 'basedosdados.br_tse_eleicoes.despesas_candidato',
    PARTIDOS: 'basedosdados.br_tse_eleicoes.partidos',
  },
}

// ============================================
// ETL Filters (Escopo inicial: MG 2022)
// ============================================

export const ETL_FILTERS = {
  ANO_ELEICAO: 2022,
  SIGLA_UF: 'MG',
  CARGOS: [
    'deputado estadual',
    'deputado federal',
    'senador',
    'governador',
  ],
  TURNO: 1, // Primeiro turno
}

// ============================================
// Mapeamento de Mesorregioes IBGE -> Nomes amigaveis
// ============================================

export const MESORREGIOES_MG: Record<number, string> = {
  3101: 'Noroeste de Minas',
  3102: 'Norte de Minas',
  3103: 'Triangulo Mineiro/Alto Paranaiba',
  3104: 'Vale do Rio Doce',
  3105: 'Oeste de Minas',
  3106: 'Metropolitana de Belo Horizonte',
  3107: 'Central Mineira',
  3108: 'Jequitinhonha',
  3109: 'Vale do Mucuri',
  3110: 'Sul/Sudoeste de Minas',
  3111: 'Zona da Mata',
  3112: 'Campo das Vertentes',
}

// ============================================
// Mapeamento de categorias de gastos TSE -> Nomes padronizados
// ============================================

export const CATEGORIAS_GASTOS: Record<string, string> = {
  'PESSOAL': 'pessoal',
  'SERVICOS CONTABEIS': 'pessoal',
  'SERVICOS ADVOCATICIOS': 'pessoal',
  'CONSULTORIA': 'pessoal',
  'PUBLICIDADE': 'midia',
  'PRODUCAO DE VIDEO': 'midia',
  'IMPRESSAO': 'material_grafico',
  'EVENTOS': 'eventos',
  'LOCACAO DE VEICULOS': 'transporte',
  'COMBUSTIVEL': 'transporte',
  'ALIMENTACAO': 'eventos',
  'HOSPEDAGEM': 'eventos',
}

// ============================================
// Batch sizes for database inserts
// ============================================

export const BATCH_CONFIG = {
  // Numero de registros por batch no upsert
  INSERT_BATCH_SIZE: 500,
  // Numero de requests paralelos permitidos
  MAX_PARALLEL_REQUESTS: 5,
}
