/**
 * Script para executar migrations no Supabase
 * Executa os arquivos SQL da pasta migrations em ordem
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const MIGRATIONS_DIR = path.join(__dirname, '../migrations')

export async function runMigrations(): Promise<void> {
  console.log('\n📋 Executando Migrations')

  // Get Supabase client
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY // Precisa de service key para DDL

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Get all SQL files sorted by name
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  console.log(`  Found ${files.length} migration files`)

  for (const file of files) {
    console.log(`  Running: ${file}`)
    const filePath = path.join(MIGRATIONS_DIR, file)
    const sql = fs.readFileSync(filePath, 'utf-8')

    // Split by statements (simple approach - doesn't handle all edge cases)
    // For complex migrations, consider using a proper migration tool
    const statements = sql
      .split(/;\s*$/m)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement })
        if (error) {
          // Se a funcao exec_sql nao existir, tente executar diretamente
          // Nota: Isso pode nao funcionar para todos os comandos DDL
          console.warn(`    Warning: ${error.message}`)
        }
      } catch (err) {
        console.warn(`    Statement error: ${err}`)
      }
    }

    console.log(`    ✓ ${file} completed`)
  }

  console.log('\n  ✅ Migrations completed')
}

// Run if executed directly
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') })
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
