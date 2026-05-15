import type { Request, Response, NextFunction } from 'express'
import { ListMunicipalitiesByStateUseCase } from '../../../application/use-cases/municipalities/ListMunicipalitiesByStateUseCase.js'
import { GetMunicipalityByCodeUseCase } from '../../../application/use-cases/municipalities/GetMunicipalityByCodeUseCase.js'
import { SupabaseMunicipalityRepository } from '../../database/repositories/SupabaseMunicipalityRepository.js'
import { getUfCode } from '../../../shared/utils/uf-codes.js'
import { AppError } from '../../../shared/errors/AppError.js'

export class MunicipalitiesController {
  async listByState(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const uf = req.params.uf as string
      const codigoUf = getUfCode(uf.toUpperCase())

      if (!codigoUf) {
        throw new AppError('UF inválida', 400)
      }

      const repository = new SupabaseMunicipalityRepository()
      const useCase = new ListMunicipalitiesByStateUseCase(repository)
      const municipalities = await useCase.execute(codigoUf)

      res.json({
        success: true,
        data: municipalities,
        meta: { total: municipalities.length }
      })
    } catch (error) {
      next(error)
    }
  }

  async getByCode(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { code } = req.params
      const codigoIbge = Number(code)

      if (isNaN(codigoIbge)) {
        throw new AppError('Código IBGE inválido', 400)
      }

      const repository = new SupabaseMunicipalityRepository()
      const useCase = new GetMunicipalityByCodeUseCase(repository)
      const municipality = await useCase.execute(codigoIbge)

      res.json({
        success: true,
        data: municipality
      })
    } catch (error) {
      next(error)
    }
  }
}
