import { Candidato } from '../entities/Candidato.js'

export interface CandidatoFilters {
  estadoId?: number
  partidoId?: number
  cargo?: string
  anoEleicao?: number
  resultado?: string
}

export interface CandidatoAggregate {
  totalVotos: number
  totalGastos: number
  custoPorVoto: number
  municipiosComVotos: number
}

export interface ICandidatoRepository {
  findById(id: number): Promise<Candidato | null>
  findBySqCandidato(sq: string, anoEleicao: number): Promise<Candidato | null>
  findByIdCandidatoBd(idCandidatoBd: string): Promise<Candidato | null>
  findByFilters(filters: CandidatoFilters): Promise<Candidato[]>
  findByEstadoAndCargo(estadoId: number, cargo: string, anoEleicao: number): Promise<Candidato[]>
  findCompetidores(estadoId: number, cargo: string, anoEleicao: number): Promise<Candidato[]>
  getAggregate(candidatoId: number, anoEleicao: number): Promise<CandidatoAggregate | null>
  upsert(candidato: Candidato): Promise<Candidato>
  upsertBatch(candidatos: Candidato[]): Promise<void>
}
