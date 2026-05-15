/**
 * ETL Orchestrator
 * Executa todos os scripts de ETL na ordem correta
 *
 * Ordem de execucao:
 * 1. IBGE - Estados, Municipios, Populacao, GeoJSON (dimensoes geograficas)
 * 2. TSE - Partidos, Candidatos (dimensoes eleitorais)
 * 3. TSE - Votacao, Gastos (fatos)
 */

import * as path from 'path'

// Import ETL functions
import { etlEstados } from '../etl/ibge-estados'
import { etlMunicipios } from '../etl/ibge-municipios'
import { etlPopulacao } from '../etl/ibge-populacao'
import { etlGeoJSON } from '../etl/ibge-geojson'
import { etlPartidos } from '../etl/tse-partidos'
import { etlCandidatos } from '../etl/tse-candidatos'
import { etlVotacao } from '../etl/tse-votacao'
import { etlGastos } from '../etl/tse-gastos'

interface ETLStep {
  name: string
  fn: () => Promise<void>
  optional?: boolean
}

const ETL_STEPS: ETLStep[] = [
  // Fase 1: Dimensoes IBGE
  { name: 'Estados (IBGE)', fn: etlEstados },
  { name: 'Municipios (IBGE)', fn: etlMunicipios },
  { name: 'Populacao (IBGE SIDRA)', fn: etlPopulacao, optional: true },
  { name: 'Coordenadas (IBGE GeoJSON)', fn: etlGeoJSON, optional: true },

  // Fase 2: Dimensoes TSE
  { name: 'Partidos (Base dos Dados)', fn: etlPartidos },
  { name: 'Candidatos (Base dos Dados)', fn: etlCandidatos },

  // Fase 3: Fatos TSE
  { name: 'Votacao (Base dos Dados)', fn: etlVotacao },
  { name: 'Gastos (Base dos Dados)', fn: etlGastos },
]

export async function runETL(options?: { skipOptional?: boolean }): Promise<void> {
  console.log('🚀 Iniciando ETL ElegeHub CRM')
  console.log('=' .repeat(50))

  const startTime = Date.now()
  const results: { step: string; status: 'success' | 'error' | 'skipped'; time: number; error?: string }[] = []

  for (const step of ETL_STEPS) {
    if (step.optional && options?.skipOptional) {
      console.log(`\n⏭️ Skipping (optional): ${step.name}`)
      results.push({ step: step.name, status: 'skipped', time: 0 })
      continue
    }

    const stepStart = Date.now()
    console.log(`\n▶️ Starting: ${step.name}`)

    try {
      await step.fn()
      const stepTime = Date.now() - stepStart
      results.push({ step: step.name, status: 'success', time: stepTime })
      console.log(`  ⏱️ Completed in ${(stepTime / 1000).toFixed(1)}s`)
    } catch (err) {
      const stepTime = Date.now() - stepStart
      const errorMessage = err instanceof Error ? err.message : String(err)
      results.push({ step: step.name, status: 'error', time: stepTime, error: errorMessage })
      console.error(`  ❌ Error: ${errorMessage}`)

      // Continue with next step unless it's a critical dimension
      if (!step.optional) {
        console.error(`  ⚠️ Critical step failed. Some dependent steps may fail.`)
      }
    }
  }

  // Summary
  const totalTime = Date.now() - startTime
  console.log('\n' + '=' .repeat(50))
  console.log('📊 ETL Summary')
  console.log('=' .repeat(50))

  for (const result of results) {
    const icon = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⏭️'
    const timeStr = result.time > 0 ? ` (${(result.time / 1000).toFixed(1)}s)` : ''
    console.log(`  ${icon} ${result.step}${timeStr}`)
    if (result.error) {
      console.log(`      Error: ${result.error}`)
    }
  }

  const successCount = results.filter((r) => r.status === 'success').length
  const errorCount = results.filter((r) => r.status === 'error').length
  const skippedCount = results.filter((r) => r.status === 'skipped').length

  console.log('\n' + '-'.repeat(50))
  console.log(`  Total: ${successCount} success, ${errorCount} errors, ${skippedCount} skipped`)
  console.log(`  Time: ${(totalTime / 1000).toFixed(1)}s`)
  console.log('=' .repeat(50))

  if (errorCount > 0) {
    console.log('\n⚠️ ETL completed with errors')
  } else {
    console.log('\n✅ ETL completed successfully!')
  }
}

// CLI arguments parser
function parseArgs(): { skipOptional: boolean; help: boolean } {
  const args = process.argv.slice(2)
  return {
    skipOptional: args.includes('--skip-optional') || args.includes('-s'),
    help: args.includes('--help') || args.includes('-h'),
  }
}

// Run if executed directly
if (require.main === module) {
  const args = parseArgs()

  if (args.help) {
    console.log(`
ETL Orchestrator - ElegeHub CRM

Usage:
  npx tsx scripts/seed/run-etl.ts [options]

Options:
  -s, --skip-optional   Skip optional ETL steps (populacao, geojson)
  -h, --help            Show this help message

Environment Variables:
  SUPABASE_URL          Supabase project URL (required)
  SUPABASE_ANON_KEY     Supabase anonymous key (required)
  GOOGLE_APPLICATION_CREDENTIALS  Path to GCP service account key (required for BigQuery)

Examples:
  npx tsx scripts/seed/run-etl.ts
  npx tsx scripts/seed/run-etl.ts --skip-optional
`)
    process.exit(0)
  }

  require('dotenv').config({ path: path.join(__dirname, '../../.env') })

  // Verify environment
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing required environment variables:')
    console.error('   - SUPABASE_URL')
    console.error('   - SUPABASE_ANON_KEY')
    console.error('\nPlease check your .env file')
    process.exit(1)
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn('⚠️ GOOGLE_APPLICATION_CREDENTIALS not set')
    console.warn('   BigQuery steps (TSE data) will fail without this')
    console.warn('')
  }

  runETL({ skipOptional: args.skipOptional })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error:', err)
      process.exit(1)
    })
}
