import { Router } from 'express'
import { SocialAuthController } from '../controllers/SocialAuthController.js'

const router = Router()
const controller = new SocialAuthController()

// Iniciar OAuth - requer autenticação
router.get('/:platform', controller.initiateOAuth.bind(controller))

// Callbacks OAuth - NÃO requerem autenticação (vêm das plataformas)
router.get('/meta/callback', controller.handleMetaCallback.bind(controller))
router.get('/tiktok/callback', controller.handleTikTokCallback.bind(controller))
router.get('/google/callback', controller.handleGoogleCallback.bind(controller))

// Selecionar página (após callback Meta) - requer autenticação
router.post('/select-page', controller.selectPage.bind(controller))

export { router as socialAuthRoutes }
