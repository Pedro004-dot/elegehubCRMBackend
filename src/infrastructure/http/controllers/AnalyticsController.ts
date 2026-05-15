import type { Request, Response, NextFunction } from 'express'
import { SupabaseAnalyticsRepository } from '../../database/repositories/SupabaseAnalyticsRepository.js'
import { AppError } from '../../../shared/errors/AppError.js'

export class AnalyticsController {
  private repository = new SupabaseAnalyticsRepository()

  /**
   * GET /api/v1/analytics/candidatos
   * Lista candidatos com resumo de votos e gastos
   */
  async listCandidatos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cargo, partido, limit, offset } = req.query

      const candidatos = await this.repository.getCandidatos({
        cargo: cargo as string | undefined,
        partido: partido as string | undefined,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : undefined,
      })

      res.json({
        success: true,
        data: candidatos,
        meta: { total: candidatos.length },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/v1/analytics/candidatos/:id
   * Busca um candidato pelo ID
   */
  async getCandidato(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const candidatoId = Number(id)

      if (isNaN(candidatoId)) {
        throw new AppError('ID do candidato invalido', 400)
      }

      const candidato = await this.repository.getCandidatoById(candidatoId)

      if (!candidato) {
        throw new AppError('Candidato nao encontrado', 404)
      }

      res.json({
        success: true,
        data: candidato,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/v1/analytics/candidatos/:id/votos
   * Busca votos de um candidato por municipio
   */
  async getCandidatoVotos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const candidatoId = Number(id)

      if (isNaN(candidatoId)) {
        throw new AppError('ID do candidato invalido', 400)
      }

      const votos = await this.repository.getCandidatoVotos(candidatoId)

      res.json({
        success: true,
        data: votos,
        meta: { total: votos.length },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/v1/analytics/candidatos/:id/gastos
   * Busca gastos de um candidato por categoria
   */
  async getCandidatoGastos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const candidatoId = Number(id)

      if (isNaN(candidatoId)) {
        throw new AppError('ID do candidato invalido', 400)
      }

      const gastos = await this.repository.getCandidatoGastos(candidatoId)

      res.json({
        success: true,
        data: gastos,
        meta: { total: gastos.length },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/v1/analytics/municipios
   * Lista municipios de MG com dados para o mapa
   * Query params: cargo, regiao
   */
  async listMunicipios(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cargo, regiao } = req.query

      const municipios = await this.repository.getMunicipiosMG(
        cargo as string | undefined,
        regiao as string | undefined
      )

      res.json({
        success: true,
        data: municipios,
        meta: { total: municipios.length },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/v1/analytics/municipios/:id/ranking
   * Busca ranking de candidatos em um municipio
   */
  async getMunicipioRanking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const { cargo } = req.query
      const municipioId = Number(id)

      if (isNaN(municipioId)) {
        throw new AppError('ID do municipio invalido', 400)
      }

      const ranking = await this.repository.getMunicipioRanking(municipioId, cargo as string | undefined)

      res.json({
        success: true,
        data: ranking,
        meta: { total: ranking.length },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/v1/analytics/filters
   * Lista opcoes de filtro disponiveis (partidos, cargos, regioes)
   */
  async getFilters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [partidos, cargos, regioes] = await Promise.all([
        this.repository.getPartidos(),
        this.repository.getCargos(),
        this.repository.getRegioesMG(),
      ])

      res.json({
        success: true,
        data: {
          partidos,
          cargos,
          regioes,
        },
      })
    } catch (error) {
      next(error)
    }
  }
}
