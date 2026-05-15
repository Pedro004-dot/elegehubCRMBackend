/**
 * ETL: TSE Gastos
 * Carrega despesas de campanha de MG 2022 do Base dos Dados (BigQuery)
 */

import { createClient } from '@supabase/supabase-js'
import { fetchDespesasMG, DespesaBD } from './bigquery-client'
import { ETL_FILTERS, CATEGORIAS_GASTOS } from './config'
import { processBatches, createProgressLogger, normalizeString } from './utils'

// ============================================
// Types
// ============================================

interface GastoInsert {
  candidato_id: number
  ano_eleicao: number
  categoria: string
  descricao: string | null
  valor: number
  data_despesa: string | null
}

// ============================================
// Normalize spending category
// ============================================

function normalizeCategoria(tipoOriginal: string): string {
  const normalized = normalizeString(tipoOriginal)

  // Check mapping
  for (const [key, value] of Object.entries(CATEGORIAS_GASTOS)) {
    if (normalized.includes(key)) {
      return value
    }
  }

  // Default mapping based on keywords
  if (normalized.includes('PESSOAL') || normalized.includes('SERVIDOR')) {
    return 'pessoal'
  }
  if (normalized.includes('PUBLICIDADE') || normalized.includes('PROPAGANDA') || normalized.includes('MIDIA')) {
    return 'midia'
  }
  if (normalized.includes('GRAFICO') || normalized.includes('IMPRESSAO') || normalized.includes('SANTINHO')) {
    return 'material_grafico'
  }
  if (normalized.includes('EVENTO') || normalized.includes('COMICIO') || normalized.includes('REFEICAO')) {
    return 'eventos'
  }
  if (normalized.includes('TRANSPORTE') || normalized.includes('COMBUSTIVEL') || normalized.includes('VEICULO')) {
    return 'transporte'
  }

  return 'outros'
}

// ============================================
// Main ETL Function
// ============================================

export async function etlGastos(): Promise<void> {
  console.log('\n💰 ETL: Gastos de Campanha de MG 2022')

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

  // 2. Fetch despesas from Base dos Dados
  console.log('  Fetching despesas from Base dos Dados...')
  const despesas = await fetchDespesasMG()
  console.log(`  Found ${despesas.length} despesas records`)

  // 3. Transform data (filter only those with matching candidato)
  const gastosToInsert: GastoInsert[] = []
  let skipped = 0

  for (const d of despesas) {
    const candidatoId = candidatoMap.get(d.id_candidato_bd)

    if (!candidatoId) {
      skipped++
      continue
    }

    // BigQuery pode retornar datas como objeto {"value": "YYYY-MM-DD"}
    let dataDespesa: string | null = null
    if (d.data_despesa) {
      if (typeof d.data_despesa === 'object' && 'value' in d.data_despesa) {
        dataDespesa = d.data_despesa.value
      } else if (typeof d.data_despesa === 'string') {
        dataDespesa = d.data_despesa
      }
    }

    // Usar tipo_despesa ou origem_despesa para categorização
    const tipoParaCategorizar = d.tipo_despesa || d.origem_despesa || 'outros'

    gastosToInsert.push({
      candidato_id: candidatoId,
      ano_eleicao: d.ano,
      categoria: normalizeCategoria(tipoParaCategorizar),
      descricao: d.descricao_despesa,
      valor: d.valor_despesa,
      data_despesa: dataDespesa,
    })
  }

  console.log(`  ${gastosToInsert.length} gastos to insert (${skipped} skipped - no match)`)

  // 4. Aggregate by candidato + categoria before inserting
  // This reduces the number of records and makes analysis easier
  const aggregatedGastos = new Map<string, GastoInsert>()

  for (const g of gastosToInsert) {
    const key = `${g.candidato_id}-${g.categoria}-${g.ano_eleicao}`
    const existing = aggregatedGastos.get(key)

    if (existing) {
      existing.valor += g.valor
    } else {
      aggregatedGastos.set(key, { ...g, descricao: null }) // Remove individual descriptions
    }
  }

  const gastosAggregated = Array.from(aggregatedGastos.values())
  console.log(`  Aggregated to ${gastosAggregated.length} records (by candidato+categoria)`)

  // 5. Insert to Supabase in batches
  console.log('  Inserting to database...')
  const progress = createProgressLogger('Gastos', gastosAggregated.length)

  // First, clear existing data for this year
  const { error: deleteError } = await supabase
    .from('fact_gastos')
    .delete()
    .eq('ano_eleicao', ETL_FILTERS.ANO_ELEICAO)

  if (deleteError) {
    console.warn(`  Warning: Could not clear existing data: ${deleteError.message}`)
  }

  await processBatches(gastosAggregated, async (batch) => {
    const { error } = await supabase
      .from('fact_gastos')
      .insert(batch)

    if (error) {
      console.error(`  Batch error:`, error.message)
    }

    progress.increment(batch.length)
  }, 500)

  progress.finish()

  // 6. Print summary by category
  const categorySummary = new Map<string, number>()
  for (const g of gastosAggregated) {
    const current = categorySummary.get(g.categoria) ?? 0
    categorySummary.set(g.categoria, current + g.valor)
  }

  console.log('\n  Summary by category:')
  for (const [cat, total] of Array.from(categorySummary.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: R$ ${(total / 1000000).toFixed(2)}M`)
  }

  console.log(`\n  ✅ Gastos ETL completed: ${gastosAggregated.length} records`)
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
  etlGastos()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
