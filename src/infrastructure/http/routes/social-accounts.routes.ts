import { Router } from 'express'
import { SocialAccountsController } from '../controllers/SocialAccountsController.js'

const router = Router()
const controller = new SocialAccountsController()

// Listar contas de uma campanha
router.get('/campaign/:campaignId', controller.list.bind(controller))

// Desconectar conta
router.delete('/:id', controller.disconnect.bind(controller))

// Renovar token
router.post('/:id/refresh', controller.refresh.bind(controller))

export { router as socialAccountsRoutes }
