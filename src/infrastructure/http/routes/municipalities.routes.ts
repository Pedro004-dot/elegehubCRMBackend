import { Router } from 'express'
import { MunicipalitiesController } from '../controllers/MunicipalitiesController.js'

const router = Router()
const controller = new MunicipalitiesController()

router.get('/state/:uf', controller.listByState.bind(controller))
router.get('/code/:code', controller.getByCode.bind(controller))

export { router as municipalitiesRoutes }
