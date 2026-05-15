export interface Gasto {
  id?: number
  candidatoId: number
  anoEleicao: number
  categoria: string
  descricao: string | null
  valor: number
  dataDespesa: Date | null
}

export interface GastoAggregate {
  totalGastos: number
  categorias: number
  maiorCategoria: string
  valorMaiorCategoria: number
}

export interface GastoPorCategoria {
  categoria: string
  valor: number
  percentualTotal: number
}

export interface IGastosRepository {
  findByCandidato(candidatoId: number, anoEleicao: number): Promise<Gasto[]>
  findByCandidatoPorCategoria(candidatoId: number, anoEleicao: number): Promise<GastoPorCategoria[]>
  aggregate(candidatoId: number, anoEleicao: number): Promise<GastoAggregate>
  insert(gasto: Gasto): Promise<Gasto>
  insertBatch(gastos: Gasto[]): Promise<void>
  deleteByAnoEleicao(anoEleicao: number): Promise<void>
}
