/**
 * ETL: TSE Candidatos
 * Carrega candidatos de MG 2022 do Base dos Dados (BigQuery)
 */

import { createClient } from '@supabase/supabase-js'
import { fetchCandidatosMG, CandidatoBD } from './bigquery-client'
import { ETL_FILTERS } from './config'
import { processBatches, createProgressLogger, parseDate } from './utils'

// ============================================
// Types
// ============================================

interface CandidatoInsert {
  id_candidato_bd: string
  sq_candidato: string
  nome: string
  nome_urna: string
  partido_id: number | null
  estado_id: number | null
  data_nascimento: string | null
  genero: string | null
  profissao: string | null
  escolaridade: string | null
  ano_eleicao: number
  cargo: string
  numero_candidato: number
  situacao_candidatura: string | null
  resultado: string | null
}

// ============================================
// Main ETL Function
// ============================================

export async function etlCandidatos(): Promise<void> {
  console.log('\n🧑‍💼 ETL: Candidatos de MG 2022')

  // Get Supabase client
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. Load lookup tables
  console.log('  Loading partidos lookup...')
  const { data: partidos } = await supabase
    .from('dim_partidos')
    .select('id, numero')

  const partidoMap = new Map<number, number>()
  for (const p of partidos ?? []) {
    partidoMap.set(p.numero, p.id)
  }
  console.log(`  Loaded ${partidoMap.size} partidos`)

  console.log('  Loading estado lookup...')
  const { data: estado } = await supabase
    .from('dim_estados')
    .select('id')
    .eq('codigo_uf', ETL_FILTERS.SIGLA_UF)
    .single()

  const estadoId = estado?.id
  if (!estadoId) {
    throw new Error('Estado MG not found in database')
  }

  // 2. Fetch candidatos from Base dos Dados
  console.log('  Fetching candidatos from Base dos Dados...')
  const candidatos = await fetchCandidatosMG()
  console.log(`  Found ${candidatos.length} candidatos`)

  // 3. Transform data
  const candidatosToInsert: CandidatoInsert[] = candidatos.map((c) => {
    // BigQuery pode retornar datas como objeto {"value": "YYYY-MM-DD"}
    let dataNascimento: string | null = null
    if (c.data_nascimento) {
      if (typeof c.data_nascimento === 'object' && 'value' in (c.data_nascimento as any)) {
        dataNascimento = (c.data_nascimento as any).value
      } else if (typeof c.data_nascimento === 'string') {
        dataNascimento = c.data_nascimento
      }
    }

    return {
      id_candidato_bd: c.id_candidato_bd,
      sq_candidato: c.sequencial,
      nome: c.nome,
      nome_urna: c.nome_urna,
      partido_id: partidoMap.get(c.numero_partido) ?? null,
      estado_id: estadoId,
      data_nascimento: dataNascimento,
      genero: c.genero?.charAt(0) ?? null,
      profissao: c.ocupacao,
      escolaridade: c.instrucao,
      ano_eleicao: c.ano,
      cargo: c.cargo,
      numero_candidato: c.numero,
      situacao_candidatura: c.situacao,
      resultado: null, // Campo nao existe na tabela candidatos
    }
  })

  // 4. Upsert to Supabase in batches
  console.log('  Upserting to database...')
  const progress = createProgressLogger('Candidatos', candidatosToInsert.length)

  await processBatches(candidatosToInsert, async (batch) => {
    const { error } = await supabase
      .from('dim_candidatos')
      .upsert(batch, {
        onConflict: 'id_candidato_bd',
        ignoreDuplicates: false,
      })

    if (error) {
      console.error(`  Batch error:`, error.message)
    }

    progress.increment(batch.length)
  }, 100)

  progress.finish()
  console.log(`  ✅ Candidatos ETL completed: ${candidatosToInsert.length} records`)
}

// Run if executed directly
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const isMainModule = process.argv[1] === __filename

if (isMainModule) {
  config({ path: join(__dirname, '../../.env') })
  etlCandidatos()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
