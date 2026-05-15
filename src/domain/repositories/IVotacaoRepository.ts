export interface Votacao {
  id?: number
  candidatoId: number
  municipioId: number
  anoEleicao: number
  turno: number
  votos: number
}

export interface VotacaoAggregate {
  totalVotos: number
  municipios: number
  mediaVotosPorMunicipio: number
}

export interface VotacaoPorMunicipio {
  municipioId: number
  municipioNome: string
  votos: number
  percentualTotal: number
}

export interface IVotacaoRepository {
  findByCandidato(candidatoId: number, anoEleicao: number): Promise<Votacao[]>
  findByMunicipio(municipioId: number, anoEleicao: number): Promise<Votacao[]>
  findByCandidatoDetalhado(candidatoId: number, anoEleicao: number): Promise<VotacaoPorMunicipio[]>
  aggregate(candidatoId: number, anoEleicao: number): Promise<VotacaoAggregate>
  upsert(votacao: Votacao): Promise<Votacao>
  upsertBatch(votacoes: Votacao[]): Promise<void>
  deleteByAnoEleicao(anoEleicao: number): Promise<void>
}
