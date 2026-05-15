/**
 * ETL: IBGE Estados
 * Carrega todos os 27 estados brasileiros da API do IBGE
 */

import { createClient } from '@supabase/supabase-js'
import { IBGE_CONFIG } from './config'
import { fetchWithRetry, createProgressLogger } from './utils'

// ============================================
// Types
// ============================================

interface IbgeEstado {
  id: number
  sigla: string
  nome: string
  regiao: {
    id: number
    sigla: string
    nome: string
  }
}

interface EstadoInsert {
  codigo_uf: string
  nome: string
  codigo_ibge: number
  regiao: string
}

// ============================================
// Main ETL Function
// ============================================

export async function etlEstados(): Promise<void> {
  console.log('\n📍 ETL: Estados Brasileiros')

  // Get Supabase client
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. Fetch from IBGE
  console.log('  Fetching estados from IBGE API...')
  const estados = await fetchWithRetry<IbgeEstado[]>(IBGE_CONFIG.LOCALIDADES.ESTADOS)
  console.log(`  Found ${estados.length} estados`)

  // 2. Transform data
  const estadosToInsert: EstadoInsert[] = estados.map((estado) => ({
    codigo_uf: estado.sigla,
    nome: estado.nome,
    codigo_ibge: estado.id,
    regiao: estado.regiao.nome,
  }))

  // 3. Upsert to Supabase
  console.log('  Upserting to database...')
  const progress = createProgressLogger('Estados', estadosToInsert.length)

  for (const estado of estadosToInsert) {
    const { error } = await supabase
      .from('dim_estados')
      .upsert(estado, {
        onConflict: 'codigo_uf',
      })

    if (error) {
      console.error(`  Error upserting estado ${estado.codigo_uf}:`, error.message)
    }

    progress.increment()
  }

  progress.finish()
  console.log('  ✅ Estados ETL completed')
}

// Run if executed directly
if (require.main === module) {
  require('dotenv').config({ path: '../../.env' })
  etlEstados()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
