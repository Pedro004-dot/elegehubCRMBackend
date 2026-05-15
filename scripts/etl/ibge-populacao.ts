/**
 * ETL: IBGE Populacao
 * Atualiza populacao dos municipios via API SIDRA
 */

import { createClient } from '@supabase/supabase-js'
import { IBGE_CONFIG, ETL_FILTERS } from './config'
import { fetchWithRetry, processBatches, createProgressLogger } from './utils'

// ============================================
// Types
// ============================================

interface SidraResponse {
  D1N: string // Nivel territorial
  D1C: string // Codigo do municipio
  D2N: string // Variavel
  D3N: string // Ano
  V: string   // Valor (populacao)
}

interface PopulacaoUpdate {
  codigo_ibge: string
  populacao: number
}

// ============================================
// Main ETL Function
// ============================================

export async function etlPopulacao(): Promise<void> {
  console.log('\n👥 ETL: Populacao dos Municipios')

  // Get Supabase client
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. Get municipios from database (only MG for now)
  console.log(`  Loading municipios from database...`)
  const { data: estadoMG } = await supabase
    .from('dim_estados')
    .select('id')
    .eq('codigo_uf', ETL_FILTERS.SIGLA_UF)
    .single()

  if (!estadoMG) {
    throw new Error('Estado MG not found in database')
  }

  const { data: municipios, error: munError } = await supabase
    .from('Municipios')
    .select('id, codigo_ibge')
    .eq('estado_id', estadoMG.id)

  if (munError || !municipios) {
    throw new Error('Failed to load municipios')
  }

  console.log(`  Found ${municipios.length} municipios in database`)

  // Create lookup map (convert bigint to string for comparison)
  const municipioMap = new Map<string, number>()
  for (const mun of municipios) {
    municipioMap.set(String(mun.codigo_ibge), mun.id)
  }

  // 2. Fetch population from SIDRA
  console.log('  Fetching populacao from SIDRA API...')
  console.log('  (This may take a while for the full dataset...)')

  // Use estimativas (more recent) or censo depending on availability
  const sidraUrl = IBGE_CONFIG.SIDRA.ESTIMATIVAS_POPULACAO

  let sidraData: SidraResponse[]
  try {
    sidraData = await fetchWithRetry<SidraResponse[]>(sidraUrl, { timeout: 120000 })
  } catch (error) {
    console.warn('  Failed to fetch estimativas, trying Censo 2022...')
    sidraData = await fetchWithRetry<SidraResponse[]>(
      IBGE_CONFIG.SIDRA.POPULACAO_CENSO_2022,
      { timeout: 120000 }
    )
  }

  console.log(`  Received ${sidraData.length} records from SIDRA`)

  // 3. Filter and transform data
  // SIDRA returns header row first (D1N contains 'Município' as type, rest have city names)
  // Skip header row and invalid values
  const populacaoData = sidraData
    .filter((row) => {
      // Skip header row and invalid values
      if (!row.D1C || !row.V) return false
      if (row.D1C === 'Município (Código)') return false // Skip header
      if (isNaN(parseInt(row.V))) return false
      return true
    })
    .map((row): PopulacaoUpdate => ({
      codigo_ibge: row.D1C.padStart(7, '0'),
      populacao: parseInt(row.V),
    }))
    .filter((p) => municipioMap.has(p.codigo_ibge))

  console.log(`  ${populacaoData.length} municipios matched for update`)

  // 4. Update database in batches
  console.log('  Updating populacao in database...')
  const progress = createProgressLogger('Populacao', populacaoData.length)

  let updatedCount = 0
  for (const item of populacaoData) {
    const { error } = await supabase
      .from('Municipios')
      .update({ populacao: item.populacao })
      .eq('codigo_ibge', parseInt(item.codigo_ibge, 10))

    if (!error) {
      updatedCount++
    }
    progress.increment()
  }

  progress.finish()
  console.log(`  ✅ Populacao ETL completed: ${updatedCount} municipios updated`)
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
  etlPopulacao()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
