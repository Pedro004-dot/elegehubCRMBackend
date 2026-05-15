import { RegiaoMG } from '../entities/RegiaoMG.js'

export interface IRegiaoMGRepository {
  findAll(): Promise<RegiaoMG[]>
  findById(id: number): Promise<RegiaoMG | null>
  findByNome(nome: string): Promise<RegiaoMG | null>
  findByCodigoMesorregiao(codigo: number): Promise<RegiaoMG | null>
  upsert(regiao: RegiaoMG): Promise<RegiaoMG>
}
