import { supabase } from '../supabase/client.js'

// ============================================
// Types from Views
// ============================================

export interface CandidatoResumo {
  id: number
  nome: string
  nome_urna: string
  sq_candidato: string
  cargo: string
  numero_candidato: number
  resultado: string | null
  genero: string | null
  ano_eleicao: number
  partido_sigla: string | null
  partido_nome: string | null
  espectro: string | null
  total_votos: number
  municipios_com_votos: number
  total_gastos: number
  custo_por_voto: number | null
}

export interface CandidatoVotosMunicipio {
  candidato_id: number
  municipio_id: number
  votos: number
  turno: number
  ano_eleicao: number
  municipio_nome: string
  codigo_ibge: string
  latitude: number | null
  longitude: number | null
  populacao: number | null
  regiao_nome: string | null
  votos_por_mil_hab: number | null
}

export interface MunicipioRanking {
  municipio_id: number
  municipio_nome: string
  codigo_ibge: string
  candidato_id: number
  nome_urna: string
  cargo: string
  partido: string | null
  votos: number
  ano_eleicao: number
  turno: number
  posicao: number
}

export interface MapaMunicipioMG {
  id: number
  codigo_ibge: string
  nome: string
  latitude: number | null
  longitude: number | null
  populacao: number | null
  regiao: string | null
  cargo: string | null
  total_votos_validos: number
  total_candidatos: number
  vencedor_votos: number | null
  vencedor_nome: string | null
  vencedor_partido: string | null
  vencedor_espectro: string | null
}

export interface GastoCategoria {
  candidato_id: number
  nome_urna: string
  cargo: string
  partido: string | null
  categoria: string
  total: number
  percentual: number | null
}

export interface CandidatosFilter {
  cargo?: string
  partido?: string
  limit?: number
  offset?: number
}

// ============================================
// Repository
// ============================================

export class SupabaseAnalyticsRepository {
  /**
   * Lista candidatos com resumo de votos e gastos
   */
  async getCandidatos(filters: CandidatosFilter = {}): Promise<CandidatoResumo[]> {
    let query = supabase
      .from('vw_candidato_resumo')
      .select('*')
      .order('total_votos', { ascending: false })

    if (filters.cargo) {
      query = query.eq('cargo', filters.cargo)
    }

    if (filters.partido) {
      query = query.eq('partido_sigla', filters.partido)
    }

    if (filters.limit) {
      query = query.limit(filters.limit)
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
    }

    const { data, error } = await query

    if (error) throw error
    return data as CandidatoResumo[]
  }

  /**
   * Busca um candidato pelo ID
   */
  async getCandidatoById(id: number): Promise<CandidatoResumo | null> {
    const { data, error } = await supabase
      .from('vw_candidato_resumo')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return null
    return data as CandidatoResumo
  }

  /**
   * Busca votos de um candidato por municipio
   */
  async getCandidatoVotos(candidatoId: number): Promise<CandidatoVotosMunicipio[]> {
    const { data, error } = await supabase
      .from('vw_candidato_votos_municipio')
      .select('*')
      .eq('candidato_id', candidatoId)
      .order('votos', { ascending: false })

    if (error) throw error
    return data as CandidatoVotosMunicipio[]
  }

  /**
   * Busca gastos de um candidato por categoria
   */
  async getCandidatoGastos(candidatoId: number): Promise<GastoCategoria[]> {
    const { data, error } = await supabase
      .from('vw_gastos_por_categoria')
      .select('*')
      .eq('candidato_id', candidatoId)
      .order('total', { ascending: false })

    if (error) throw error
    return data as GastoCategoria[]
  }

  /**
   * Lista municipios de MG com dados do mapa
   */
  async getMunicipiosMG(cargo?: string, regiao?: string, limit?: number): Promise<MapaMunicipioMG[]> {
    let query = supabase
      .from('vw_mapa_municipios_mg')
      .select('*')
      .order('nome')

    // Filtrar por cargo (deputado estadual, federal, senador, governador)
    if (cargo) {
      query = query.eq('cargo', cargo)
    }

    if (regiao) {
      query = query.eq('regiao', regiao)
    }

    // Limit results to prevent timeout (default all 853 MG municipalities)
    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) throw error
    return data as MapaMunicipioMG[]
  }

  /**
   * Busca ranking de candidatos em um municipio
   */
  async getMunicipioRanking(municipioId: number, cargo?: string): Promise<MunicipioRanking[]> {
    let query = supabase
      .from('vw_municipio_ranking')
      .select('*')
      .eq('municipio_id', municipioId)
      .order('posicao', { ascending: true })

    if (cargo) {
      query = query.eq('cargo', cargo)
    }

    const { data, error } = await query

    if (error) throw error
    return data as MunicipioRanking[]
  }

  /**
   * Lista partidos distintos
   */
  async getPartidos(): Promise<string[]> {
    const { data, error } = await supabase
      .from('dim_partidos')
      .select('sigla')
      .eq('ativo', true)
      .order('sigla')

    if (error) throw error
    return (data || []).map((p) => p.sigla)
  }

  /**
   * Lista cargos distintos
   */
  async getCargos(): Promise<string[]> {
    const { data, error } = await supabase
      .from('vw_candidato_resumo')
      .select('cargo')

    if (error) throw error

    const cargos = [...new Set((data || []).map((d) => d.cargo))]
    return cargos.sort()
  }

  /**
   * Lista regioes de MG
   */
  async getRegioesMG(): Promise<string[]> {
    const { data, error } = await supabase
      .from('dim_regioes_mg')
      .select('nome')
      .order('nome')

    if (error) throw error
    return (data || []).map((r) => r.nome)
  }
}
