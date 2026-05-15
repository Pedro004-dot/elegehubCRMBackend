import { Router } from 'express'
import { AnalyticsController } from '../controllers/AnalyticsController.js'

const router = Router()
const controller = new AnalyticsController()

// Filtros disponiveis (partidos, cargos, regioes)
router.get('/filters', controller.getFilters.bind(controller))

// Candidatos
router.get('/candidatos', controller.listCandidatos.bind(controller))
router.get('/candidatos/:id', controller.getCandidato.bind(controller))
router.get('/candidatos/:id/votos', controller.getCandidatoVotos.bind(controller))
router.get('/candidatos/:id/gastos', controller.getCandidatoGastos.bind(controller))

// Municipios
router.get('/municipios', controller.listMunicipios.bind(controller))
router.get('/municipios/:id/ranking', controller.getMunicipioRanking.bind(controller))

export { router as analyticsRoutes }
