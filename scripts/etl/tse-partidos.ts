/**
 * ETL: TSE Partidos
 * Carrega partidos politicos do Base dos Dados (BigQuery)
 */

import { createClient } from '@supabase/supabase-js'
import { fetchPartidos, PartidoBD } from './bigquery-client'
import { createProgressLogger } from './utils'

// ============================================
// Types
// ============================================

interface PartidoInsert {
  sigla: string
  nome: string
  numero: number
}

// ============================================
// Main ETL Function
// ============================================

export async function etlPartidos(): Promise<void> {
  console.log('\n🏛️ ETL: Partidos Politicos')

  // Get Supabase client
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. Fetch partidos from Base dos Dados
  console.log('  Fetching partidos from Base dos Dados...')
  const partidos = await fetchPartidos()
  console.log(`  Found ${partidos.length} partidos`)

  // 2. Transform and deduplicate
  const partidosMap = new Map<number, PartidoInsert>()
  for (const p of partidos) {
    if (!partidosMap.has(p.numero_partido)) {
      partidosMap.set(p.numero_partido, {
        sigla: p.sigla_partido,
        nome: p.nome_partido,
        numero: p.numero_partido,
      })
    }
  }

  const partidosToInsert = Array.from(partidosMap.values())
  console.log(`  ${partidosToInsert.length} unique partidos to insert`)

  // 3. Upsert to Supabase
  console.log('  Upserting to database...')
  const progress = createProgressLogger('Partidos', partidosToInsert.length)

  for (const partido of partidosToInsert) {
    const { error } = await supabase
      .from('dim_partidos')
      .upsert(partido, {
        onConflict: 'numero',
      })

    if (error) {
      console.error(`  Error upserting partido ${partido.sigla}:`, error.message)
    }

    progress.increment()
  }

  progress.finish()
  console.log('  ✅ Partidos ETL completed')
}

// Run if executed directly
if (require.main === module) {
  require('dotenv').config({ path: '../../.env' })
  etlPartidos()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
