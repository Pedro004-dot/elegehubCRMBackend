import { Estado } from '../entities/Estado.js'

export interface IEstadoRepository {
  findAll(): Promise<Estado[]>
  findById(id: number): Promise<Estado | null>
  findByCodigoUf(codigoUf: string): Promise<Estado | null>
  findByCodigoIbge(codigoIbge: number): Promise<Estado | null>
  upsert(estado: Estado): Promise<Estado>
  upsertBatch(estados: Estado[]): Promise<void>
}
