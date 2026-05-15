import { IMunicipalityRepository } from '../../../domain/repositories/IMunicipalityRepository.js'
import { MunicipalityDTO } from '../../dtos/MunicipalityDTO.js'
import { getUfSigla } from '../../../shared/utils/uf-codes.js'

export class ListMunicipalitiesByStateUseCase {
  constructor(private repository: IMunicipalityRepository) {}

  async execute(codigoUf: number): Promise<MunicipalityDTO[]> {
    const municipalities = await this.repository.findByUf(codigoUf)

    return municipalities.map((m) => ({
      codigoIbge: m.codigoIbge,
      nome: m.nome,
      latitude: m.latitude,
      longitude: m.longitude,
      capital: m.capital,
      codigoUf: m.codigoUf,
      uf: getUfSigla(m.codigoUf),
      ddd: m.ddd
    }))
  }
}
