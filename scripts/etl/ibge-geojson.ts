/**
 * ETL: IBGE GeoJSON
 * Extrai coordenadas (centroid) dos municipios a partir das malhas geograficas
 */

import { createClient } from '@supabase/supabase-js'
import { IBGE_CONFIG, ETL_FILTERS } from './config'
import { fetchWithRetry, createProgressLogger, calculateCentroid } from './utils'

// ============================================
// Types
// ============================================

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

interface GeoJSONFeature {
  type: 'Feature'
  properties: {
    codarea?: string
    name?: string
    [key: string]: unknown
  }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

interface CoordenadasUpdate {
  codigo_ibge: string
  latitude: number
  longitude: number
}

// ============================================
// Main ETL Function
// ============================================

export async function etlGeoJSON(uf: string = ETL_FILTERS.SIGLA_UF): Promise<void> {
  console.log(`\n🗺️ ETL: Coordenadas dos Municipios de ${uf}`)

  // Get Supabase client
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. Get municipios from database
  console.log(`  Loading municipios from database...`)
  const { data: estadoData } = await supabase
    .from('dim_estados')
    .select('id')
    .eq('codigo_uf', uf)
    .single()

  if (!estadoData) {
    throw new Error(`Estado ${uf} not found in database`)
  }

  const { data: municipios } = await supabase
    .from('Municipios')
    .select('id, codigo_ibge')
    .eq('estado_id', estadoData.id)
    .is('latitude', null) // Only update those without coordinates

  if (!municipios || municipios.length === 0) {
    console.log('  All municipios already have coordinates')
    return
  }

  console.log(`  Found ${municipios.length} municipios without coordinates`)

  // Create lookup map
  const municipioMap = new Map<string, number>()
  for (const mun of municipios) {
    municipioMap.set(mun.codigo_ibge, mun.id)
  }

  // 2. Fetch GeoJSON from IBGE
  console.log('  Fetching GeoJSON from IBGE API...')
  const geoJsonUrl = IBGE_CONFIG.MALHAS.MUNICIPIOS_DO_ESTADO(uf)

  const geojson = await fetchWithRetry<GeoJSONFeatureCollection>(geoJsonUrl, {
    timeout: 60000,
  })

  console.log(`  Received ${geojson.features.length} features`)

  // 3. Extract centroids
  const coordenadasToUpdate: CoordenadasUpdate[] = []

  for (const feature of geojson.features) {
    const codigoIbge = feature.properties.codarea?.padStart(7, '0')
    if (!codigoIbge || !municipioMap.has(codigoIbge)) {
      continue
    }

    let centroid: { lat: number; lng: number }

    if (feature.geometry.type === 'Polygon') {
      centroid = calculateCentroid(feature.geometry.coordinates as number[][][])
    } else if (feature.geometry.type === 'MultiPolygon') {
      // For MultiPolygon, use the first polygon
      const firstPolygon = (feature.geometry.coordinates as number[][][][])[0]
      if (firstPolygon) {
        centroid = calculateCentroid(firstPolygon)
      } else {
        continue
      }
    } else {
      continue
    }

    coordenadasToUpdate.push({
      codigo_ibge: codigoIbge,
      latitude: centroid.lat,
      longitude: centroid.lng,
    })
  }

  console.log(`  Calculated centroids for ${coordenadasToUpdate.length} municipios`)

  // 4. Update database
  console.log('  Updating coordenadas in database...')
  const progress = createProgressLogger('Coordenadas', coordenadasToUpdate.length)

  let updatedCount = 0
  for (const item of coordenadasToUpdate) {
    const { error } = await supabase
      .from('Municipios')
      .update({
        latitude: item.latitude,
        longitude: item.longitude,
      })
      .eq('codigo_ibge', item.codigo_ibge)

    if (!error) {
      updatedCount++
    }
    progress.increment()
  }

  progress.finish()
  console.log(`  ✅ GeoJSON ETL completed: ${updatedCount} municipios updated with coordinates`)
}

// Run if executed directly
if (require.main === module) {
  require('dotenv').config({ path: '../../.env' })
  etlGeoJSON()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
