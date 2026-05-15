/**
 * ETL: TSE Votacao
 * Carrega votos por municipio de MG 2022 do Base dos Dados (BigQuery)
 */

import { createClient } from '@supabase/supabase-js'
import { fetchVotosMG, VotacaoBD } from './bigquery-client'
import { ETL_FILTERS } from './config'
import { processBatches, createProgressLogger } from './utils'

// ============================================
// Types
// ============================================

interface VotacaoInsert {
  candidato_id: number
  municipio_id: number
  ano_eleicao: number
  turno: number
  votos: number
}

// ============================================
// Main ETL Function
// ============================================

export async function etlVotacao(): Promise<void> {
  console.log('\n🗳️ ETL: Votacao de MG 2022')

  // Get Supabase client
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. Load candidato lookup (by id_candidato_bd)
  console.log('  Loading candidatos lookup...')
  const { data: candidatos } = await supabase
    .from('dim_candidatos')
    .select('id, id_candidato_bd')
    .eq('ano_eleicao', ETL_FILTERS.ANO_ELEICAO)

  const candidatoMap = new Map<string, number>()
  for (const c of candidatos ?? []) {
    if (c.id_candidato_bd) {
      candidatoMap.set(c.id_candidato_bd, c.id)
    }
  }
  console.log(`  Loaded ${candidatoMap.size} candidatos`)

  // 2. Load municipio lookup (by codigo_ibge)
  console.log('  Loading municipios lookup...')
  const { data: estado } = await supabase
    .from('dim_estados')
    .select('id')
    .eq('codigo_uf', ETL_FILTERS.SIGLA_UF)
    .single()

  const { data: municipios } = await supabase
    .from('Municipios')
    .select('id, codigo_ibge')
    .eq('estado_id', estado?.id)

  const municipioMap = new Map<string, number>()
  for (const m of municipios ?? []) {
    // Converter codigo_ibge para string (pode ser bigint do banco)
    const codigoStr = String(m.codigo_ibge)
    municipioMap.set(codigoStr, m.id)
  }
  console.log(`  Loaded ${municipioMap.size} municipios`)

  // 3. Fetch votos from Base dos Dados
  console.log('  Fetching votos from Base dos Dados...')
  const votos = await fetchVotosMG()
  console.log(`  Found ${votos.length} votos records`)

  // 4. Transform data (filter only those with matching IDs)
  const votosToInsert: VotacaoInsert[] = []
  let skipped = 0

  for (const v of votos) {
    const candidatoId = candidatoMap.get(v.id_candidato_bd)
    // Ajustar codigo do municipio se necessario
    const codigoMunicipio = v.id_municipio.padStart(7, '0')
    const municipioId = municipioMap.get(codigoMunicipio)

    if (!candidatoId || !municipioId) {
      skipped++
      continue
    }

    votosToInsert.push({
      candidato_id: candidatoId,
      municipio_id: municipioId,
      ano_eleicao: v.ano,
      turno: v.turno,
      votos: v.votos,
    })
  }

  console.log(`  ${votosToInsert.length} votos to insert (${skipped} skipped - no match)`)

  // 5. Upsert to Supabase in batches
  console.log('  Upserting to database...')
  const progress = createProgressLogger('Votos', votosToInsert.length)

  await processBatches(votosToInsert, async (batch) => {
    const { error } = await supabase
      .from('fact_votacao')
      .upsert(batch, {
        onConflict: 'candidato_id,municipio_id,ano_eleicao,turno',
      })

    if (error) {
      console.error(`  Batch error:`, error.message)
    }

    progress.increment(batch.length)
  }, 500)

  progress.finish()
  console.log(`  ✅ Votacao ETL completed: ${votosToInsert.length} records`)
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
  etlVotacao()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
