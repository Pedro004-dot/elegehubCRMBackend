/**
 * BigQuery Client for Base dos Dados
 * Acessa dados eleitorais do TSE via BigQuery publico
 */

import { BigQuery } from '@google-cloud/bigquery'
import { BASEDOSDADOS_CONFIG, ETL_FILTERS } from './config'

// ============================================
// Types
// ============================================

export interface CandidatoBD {
  id_candidato_bd: string // Gerado: ano-sigla_uf-sequencial
  ano: number
  tipo_eleicao: string
  sigla_uf: string
  id_municipio: string | null
  sequencial: string
  numero: number
  nome: string
  nome_urna: string
  numero_partido: number
  sigla_partido: string
  cargo: string
  situacao: string
  ocupacao: string | null
  data_nascimento: string | null
  idade: number | null
  genero: string | null
  instrucao: string | null
  estado_civil: string | null
  nacionalidade: string | null
  sigla_uf_nascimento: string | null
  municipio_nascimento: string | null
  email: string | null
  raca: string | null
}

export interface VotacaoBD {
  ano: number
  turno: number
  sigla_uf: string
  id_municipio: string
  cargo: string
  sequencial_candidato: string
  id_candidato_bd: string // Gerado: ano-uf-sequencial
  votos: number
}

export interface DespesaBD {
  ano: number
  turno: number
  sigla_uf: string
  sequencial_candidato: string
  id_candidato_bd: string // Gerado: ano-uf-sequencial
  tipo_despesa: string | null
  descricao_despesa: string | null
  origem_despesa: string | null
  valor_despesa: number
  data_despesa: string | { value: string } | null
}

export interface PartidoBD {
  ano: number
  tipo_eleicao: string
  numero_partido: number
  sigla_partido: string
  nome_partido: string
}

// ============================================
// BigQuery Client
// ============================================

let bigqueryClient: BigQuery | null = null

function getBigQueryClient(): BigQuery {
  if (!bigqueryClient) {
    // Usar projeto do usuario para criar jobs (billing)
    // As queries acessam dados publicos do basedosdados
    bigqueryClient = new BigQuery({
      projectId: BASEDOSDADOS_CONFIG.USER_PROJECT_ID,
    })
  }
  return bigqueryClient
}

/**
 * Execute a BigQuery query and return results
 */
export async function queryBigQuery<T>(sql: string): Promise<T[]> {
  const client = getBigQueryClient()

  console.log('  Executing BigQuery query...')
  const [job] = await client.createQueryJob({
    query: sql,
    location: 'US',
  })

  console.log(`  Job ${job.id} started, waiting for results...`)
  const [rows] = await job.getQueryResults()

  console.log(`  Query returned ${rows.length} rows`)
  return rows as T[]
}

// ============================================
// Query Builders
// ============================================

/**
 * Fetch candidates from MG 2022
 */
export async function fetchCandidatosMG(): Promise<CandidatoBD[]> {
  const cargosFilter = ETL_FILTERS.CARGOS.map((c) => `'${c}'`).join(', ')

  const sql = `
    SELECT
      CONCAT(CAST(ano AS STRING), '-', sigla_uf, '-', sequencial) as id_candidato_bd,
      ano,
      tipo_eleicao,
      sigla_uf,
      id_municipio,
      sequencial,
      numero,
      nome,
      nome_urna,
      numero_partido,
      sigla_partido,
      cargo,
      situacao,
      ocupacao,
      data_nascimento,
      idade,
      genero,
      instrucao,
      estado_civil,
      nacionalidade,
      sigla_uf_nascimento,
      municipio_nascimento,
      email,
      raca
    FROM \`${BASEDOSDADOS_CONFIG.FQN.CANDIDATOS}\`
    WHERE ano = ${ETL_FILTERS.ANO_ELEICAO}
      AND sigla_uf = '${ETL_FILTERS.SIGLA_UF}'
      AND cargo IN (${cargosFilter})
    ORDER BY nome
  `

  return queryBigQuery<CandidatoBD>(sql)
}

/**
 * Fetch votes by municipality for MG 2022
 */
export async function fetchVotosMG(): Promise<VotacaoBD[]> {
  const cargosFilter = ETL_FILTERS.CARGOS.map((c) => `'${c}'`).join(', ')

  const sql = `
    SELECT
      ano,
      turno,
      sigla_uf,
      id_municipio,
      cargo,
      sequencial_candidato,
      CONCAT(CAST(ano AS STRING), '-', sigla_uf, '-', sequencial_candidato) as id_candidato_bd,
      votos
    FROM \`${BASEDOSDADOS_CONFIG.FQN.VOTOS}\`
    WHERE ano = ${ETL_FILTERS.ANO_ELEICAO}
      AND sigla_uf = '${ETL_FILTERS.SIGLA_UF}'
      AND turno = ${ETL_FILTERS.TURNO}
      AND cargo IN (${cargosFilter})
    ORDER BY id_municipio, votos DESC
  `

  return queryBigQuery<VotacaoBD>(sql)
}

/**
 * Fetch campaign spending for MG 2022
 */
export async function fetchDespesasMG(): Promise<DespesaBD[]> {
  const cargosFilter = ETL_FILTERS.CARGOS.map((c) => `'${c}'`).join(', ')

  const sql = `
    SELECT
      ano,
      turno,
      sigla_uf,
      sequencial_candidato,
      CONCAT(CAST(ano AS STRING), '-', sigla_uf, '-', sequencial_candidato) as id_candidato_bd,
      tipo_despesa,
      descricao_despesa,
      origem_despesa,
      valor_despesa,
      data_despesa
    FROM \`${BASEDOSDADOS_CONFIG.FQN.DESPESAS}\`
    WHERE ano = ${ETL_FILTERS.ANO_ELEICAO}
      AND sigla_uf = '${ETL_FILTERS.SIGLA_UF}'
      AND turno = ${ETL_FILTERS.TURNO}
      AND cargo IN (${cargosFilter})
    ORDER BY sequencial_candidato, valor_despesa DESC
  `

  return queryBigQuery<DespesaBD>(sql)
}

/**
 * Fetch unique parties from 2022 election
 */
export async function fetchPartidos(): Promise<PartidoBD[]> {
  const sql = `
    SELECT DISTINCT
      ano,
      tipo_eleicao,
      numero_partido,
      sigla_partido,
      nome_partido
    FROM \`${BASEDOSDADOS_CONFIG.FQN.CANDIDATOS}\`
    WHERE ano = ${ETL_FILTERS.ANO_ELEICAO}
      AND sigla_partido IS NOT NULL
      AND nome_partido IS NOT NULL
    ORDER BY numero_partido
  `

  return queryBigQuery<PartidoBD>(sql)
}

/**
 * Get count of records for planning
 */
export async function getCounts(): Promise<{
  candidatos: number
  votos: number
  despesas: number
}> {
  const cargosFilter = ETL_FILTERS.CARGOS.map((c) => `'${c}'`).join(', ')

  const sql = `
    SELECT
      (SELECT COUNT(*) FROM \`${BASEDOSDADOS_CONFIG.FQN.CANDIDATOS}\`
       WHERE ano = ${ETL_FILTERS.ANO_ELEICAO} AND sigla_uf = '${ETL_FILTERS.SIGLA_UF}'
       AND cargo IN (${cargosFilter})) as candidatos,
      (SELECT COUNT(*) FROM \`${BASEDOSDADOS_CONFIG.FQN.VOTOS}\`
       WHERE ano = ${ETL_FILTERS.ANO_ELEICAO} AND sigla_uf = '${ETL_FILTERS.SIGLA_UF}'
       AND turno = ${ETL_FILTERS.TURNO} AND cargo IN (${cargosFilter})) as votos,
      (SELECT COUNT(*) FROM \`${BASEDOSDADOS_CONFIG.FQN.DESPESAS}\`
       WHERE ano = ${ETL_FILTERS.ANO_ELEICAO} AND sigla_uf = '${ETL_FILTERS.SIGLA_UF}'
       AND turno = ${ETL_FILTERS.TURNO}) as despesas
  `

  const [result] = await queryBigQuery<{
    candidatos: number
    votos: number
    despesas: number
  }>(sql)

  return result ?? { candidatos: 0, votos: 0, despesas: 0 }
}
