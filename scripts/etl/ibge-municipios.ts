/**
 * ETL: IBGE Municipios
 * Carrega municipios de MG (ou todos) da API do IBGE
 */

import { createClient } from '@supabase/supabase-js'
import { IBGE_CONFIG, ETL_FILTERS, MESORREGIOES_MG } from './config'
import { fetchWithRetry, processBatches, createProgressLogger } from './utils'

// ============================================
// Types
// ============================================

interface IbgeMunicipio {
  id: number
  nome: string
  microrregiao: {
    id: number
    nome: string
    mesorregiao: {
      id: number
      nome: string
      UF: {
        id: number
        sigla: string
        nome: string
      }
    }
  }
}

interface MunicipioInsert {
  codigo_ibge: string
  nome: string
  estado_id: number
  regiao_mg_id: number | null
}

// ============================================
// Main ETL Function
// ============================================

export async function etlMunicipios(uf: string = ETL_FILTERS.SIGLA_UF): Promise<void> {
  console.log(`\n🏘️ ETL: Municipios de ${uf}`)

  // Get Supabase client
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. Get estado_id from database
  console.log(`  Looking up estado_id for ${uf}...`)
  const { data: estadoData, error: estadoError } = await supabase
    .from('dim_estados')
    .select('id')
    .eq('codigo_uf', uf)
    .single()

  if (estadoError || !estadoData) {
    throw new Error(`Estado ${uf} not found in database. Run etlEstados first.`)
  }

  const estadoId = estadoData.id
  console.log(`  Estado ${uf} has id ${estadoId}`)

  // 2. Get regiao mapping if MG
  let regiaoMap: Map<number, number> = new Map()
  if (uf === 'MG') {
    console.log('  Loading MG regions mapping...')
    const { data: regioes, error: regioesError } = await supabase
      .from('dim_regioes_mg')
      .select('id, codigo_mesorregiao')

    if (!regioesError && regioes) {
      for (const r of regioes) {
        regiaoMap.set(r.codigo_mesorregiao, r.id)
      }
    }
    console.log(`  Loaded ${regiaoMap.size} MG regions`)
  }

  // 3. Fetch municipios from IBGE
  console.log('  Fetching municipios from IBGE API...')
  const municipios = await fetchWithRetry<IbgeMunicipio[]>(
    IBGE_CONFIG.LOCALIDADES.MUNICIPIOS_POR_UF(uf)
  )
  console.log(`  Found ${municipios.length} municipios`)

  // 4. Transform data
  const municipiosToInsert: MunicipioInsert[] = municipios.map((mun) => {
    const codigoMesorregiao = mun.microrregiao.mesorregiao.id
    const regiaoMgId = regiaoMap.get(codigoMesorregiao) ?? null

    return {
      codigo_ibge: String(mun.id).padStart(7, '0'),
      nome: mun.nome,
      estado_id: estadoId,
      regiao_mg_id: regiaoMgId,
    }
  })

  // 5. Upsert to Supabase in batches
  console.log('  Upserting to database...')
  const progress = createProgressLogger('Municipios', municipiosToInsert.length)

  await processBatches(municipiosToInsert, async (batch) => {
    const { error } = await supabase
      .from('Municipios')
      .upsert(batch, {
        onConflict: 'codigo_ibge',
      })

    if (error) {
      console.error(`  Batch error:`, error.message)
    }

    progress.increment(batch.length)
  }, 100)

  progress.finish()
  console.log(`  ✅ Municipios de ${uf} ETL completed`)
}

// Run if executed directly
if (require.main === module) {
  require('dotenv').config({ path: '../../.env' })
  etlMunicipios()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
