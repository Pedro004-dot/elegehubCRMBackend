import { IMunicipalityRepository } from '../../../domain/repositories/IMunicipalityRepository.js'
import { Municipality } from '../../../domain/entities/Municipality.js'
import { supabase } from '../supabase/client.js'

interface MunicipioRow {
  codigo_ibge: number
  nome: string
  latitude: number | null
  longitude: number | null
  capital: number
  codigo_uf: number
  siafi_id: number
  ddd: number
  fuso_horario: string
}

export class SupabaseMunicipalityRepository implements IMunicipalityRepository {
  private mapRowToEntity(row: MunicipioRow): Municipality {
    return Municipality.create({
      codigoIbge: row.codigo_ibge,
      nome: row.nome,
      latitude: row.latitude,
      longitude: row.longitude,
      capital: row.capital === 1,
      codigoUf: row.codigo_uf,
      siafiId: row.siafi_id,
      ddd: row.ddd,
      fusoHorario: row.fuso_horario
    })
  }

  async findByUf(codigoUf: number): Promise<Municipality[]> {
    const { data, error } = await supabase
      .from('Municipios')
      .select('*')
      .eq('codigo_uf', codigoUf)
      .order('nome')

    if (error) throw error

    return (data as MunicipioRow[]).map((row) => this.mapRowToEntity(row))
  }

  async findByCode(codigoIbge: number): Promise<Municipality | null> {
    const { data, error } = await supabase
      .from('Municipios')
      .select('*')
      .eq('codigo_ibge', codigoIbge)
      .single()

    if (error || !data) return null

    return this.mapRowToEntity(data as MunicipioRow)
  }

  async findAll(): Promise<Municipality[]> {
    const { data, error } = await supabase
      .from('Municipios')
      .select('*')
      .order('nome')

    if (error) throw error

    return (data as MunicipioRow[]).map((row) => this.mapRowToEntity(row))
  }
}
