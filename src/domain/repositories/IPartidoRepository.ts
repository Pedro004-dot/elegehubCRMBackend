import { Partido } from '../entities/Partido.js'

export interface IPartidoRepository {
  findAll(): Promise<Partido[]>
  findById(id: number): Promise<Partido | null>
  findBySigla(sigla: string): Promise<Partido | null>
  findByNumero(numero: number): Promise<Partido | null>
  upsert(partido: Partido): Promise<Partido>
  upsertBatch(partidos: Partido[]): Promise<void>
}
