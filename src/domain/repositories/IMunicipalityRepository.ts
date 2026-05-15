import { Municipality } from '../entities/Municipality.js'

export interface IMunicipalityRepository {
  findByUf(codigoUf: number): Promise<Municipality[]>
  findByCode(codigoIbge: number): Promise<Municipality | null>
  findAll(): Promise<Municipality[]>
}
