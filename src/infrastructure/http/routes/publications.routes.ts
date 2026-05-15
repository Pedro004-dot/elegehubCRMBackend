import { Router } from 'express'
import { PublicationsController } from '../controllers/PublicationsController.js'

const router = Router()
const controller = new PublicationsController()

// Agendar publicação
router.post('/campaign/:campaignId/schedule', controller.schedule.bind(controller))

// Publicar imediatamente
router.post('/campaign/:campaignId/publish-now', controller.publishNow.bind(controller))

// Listar publicações agendadas
router.get('/campaign/:campaignId/scheduled', controller.listScheduled.bind(controller))

// Cancelar publicação agendada
router.delete('/campaign/:campaignId/scheduled/:id', controller.cancel.bind(controller))

export { router as publicationsRoutes }
