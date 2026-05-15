import { IMunicipalityRepository } from '../../../domain/repositories/IMunicipalityRepository.js'
import { MunicipalityDTO } from '../../dtos/MunicipalityDTO.js'
import { getUfSigla } from '../../../shared/utils/uf-codes.js'
import { AppError } from '../../../shared/errors/AppError.js'

export class GetMunicipalityByCodeUseCase {
  constructor(private repository: IMunicipalityRepository) {}

  async execute(codigoIbge: number): Promise<MunicipalityDTO> {
    const municipality = await this.repository.findByCode(codigoIbge)

    if (!municipality) {
      throw new AppError('Município não encontrado', 404)
    }

    return {
      codigoIbge: municipality.codigoIbge,
      nome: municipality.nome,
      latitude: municipality.latitude,
      longitude: municipality.longitude,
      capital: municipality.capital,
      codigoUf: municipality.codigoUf,
      uf: getUfSigla(municipality.codigoUf),
      ddd: municipality.ddd
    }
  }
}
