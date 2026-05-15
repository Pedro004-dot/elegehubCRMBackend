/**
 * ETL Utility Functions
 */

import { IBGE_CONFIG, BATCH_CONFIG } from './config'

// ============================================
// HTTP Fetch with retry
// ============================================

export async function fetchWithRetry<T>(
  url: string,
  options: {
    retries?: number
    timeout?: number
    headers?: Record<string, string>
  } = {}
): Promise<T> {
  const { retries = 3, timeout = IBGE_CONFIG.TIMEOUT, headers = {} } = options

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          ...headers,
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json() as T
    } catch (error) {
      lastError = error as Error
      console.warn(`Attempt ${attempt}/${retries} failed for ${url}: ${lastError.message}`)

      if (attempt < retries) {
        // Exponential backoff
        await sleep(Math.pow(2, attempt) * 1000)
      }
    }
  }

  throw new Error(`Failed after ${retries} attempts: ${lastError?.message}`)
}

// ============================================
// Sleep utility
// ============================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================
// Batch processing
// ============================================

export async function processBatches<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R>,
  batchSize: number = BATCH_CONFIG.INSERT_BATCH_SIZE
): Promise<R[]> {
  const results: R[] = []
  const totalBatches = Math.ceil(items.length / batchSize)

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchNumber = Math.floor(i / batchSize) + 1

    console.log(`  Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`)

    const result = await processor(batch)
    results.push(result)
  }

  return results
}

// ============================================
// Parallel execution with limit
// ============================================

export async function parallelLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  limit: number = BATCH_CONFIG.MAX_PARALLEL_REQUESTS
): Promise<R[]> {
  const results: R[] = []
  const executing: Promise<void>[] = []

  for (const item of items) {
    const promise = processor(item).then((result) => {
      results.push(result)
    })

    executing.push(promise)

    if (executing.length >= limit) {
      await Promise.race(executing)
      // Remove completed promises
      const completed = executing.filter((p) => {
        // Check if promise is settled (hacky but works)
        let settled = false
        p.then(
          () => { settled = true },
          () => { settled = true }
        )
        return !settled
      })
      executing.length = 0
      executing.push(...completed)
    }
  }

  await Promise.all(executing)
  return results
}

// ============================================
// GeoJSON Centroid calculation
// ============================================

export function calculateCentroid(coordinates: number[][][]): { lat: number; lng: number } {
  // Simple centroid for polygon (average of all points)
  let sumLat = 0
  let sumLng = 0
  let count = 0

  for (const ring of coordinates) {
    for (const point of ring) {
      sumLng += point[0] ?? 0
      sumLat += point[1] ?? 0
      count++
    }
  }

  return {
    lng: count > 0 ? sumLng / count : 0,
    lat: count > 0 ? sumLat / count : 0,
  }
}

// ============================================
// String normalization
// ============================================

export function normalizeString(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toUpperCase()
}

export function capitalizeWords(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ============================================
// Date parsing
// ============================================

export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null

  // Try different formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
  ]

  for (const format of formats) {
    const match = dateStr.match(format)
    if (match) {
      if (format === formats[0]) {
        return new Date(parseInt(match[1]!), parseInt(match[2]!) - 1, parseInt(match[3]!))
      }
      if (format === formats[1]) {
        return new Date(parseInt(match[3]!), parseInt(match[2]!) - 1, parseInt(match[1]!))
      }
    }
  }

  return null
}

// ============================================
// Progress logging
// ============================================

export function createProgressLogger(taskName: string, total: number) {
  let current = 0
  const startTime = Date.now()

  return {
    increment(count: number = 1) {
      current += count
      const percentage = Math.round((current / total) * 100)
      const elapsed = (Date.now() - startTime) / 1000
      const rate = current / elapsed
      const remaining = (total - current) / rate

      process.stdout.write(
        `\r  ${taskName}: ${current}/${total} (${percentage}%) - ${rate.toFixed(1)}/s - ETA: ${formatTime(remaining)}`
      )
    },
    finish() {
      const elapsed = (Date.now() - startTime) / 1000
      console.log(`\n  ${taskName}: Completed ${total} items in ${formatTime(elapsed)}`)
    },
  }
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

// ============================================
// Validation helpers
// ============================================

export function isValidIbgeCode(code: string | number): boolean {
  const codeStr = String(code)
  return /^\d{7}$/.test(codeStr)
}

export function isValidUf(uf: string): boolean {
  const validUfs = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
  ]
  return validUfs.includes(uf.toUpperCase())
}

// ============================================
// Error handling
// ============================================

export class ETLError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly details?: unknown
  ) {
    super(`[${source}] ${message}`)
    this.name = 'ETLError'
  }
}
