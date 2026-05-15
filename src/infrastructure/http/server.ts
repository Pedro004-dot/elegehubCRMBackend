import express from 'express'
import cors from 'cors'
import { env } from '../config/env.js'
import { municipalitiesRoutes } from './routes/municipalities.routes.js'
import { socialAuthRoutes } from './routes/social-auth.routes.js'
import { socialAccountsRoutes } from './routes/social-accounts.routes.js'
import { publicationsRoutes } from './routes/publications.routes.js'
import { analyticsRoutes } from './routes/analytics.routes.js'
import { errorHandler } from './middlewares/error-handler.js'

const app = express()

// Middlewares
app.use(
  cors({
    origin: env.CORS_ORIGINS.split(',').map((origin) => origin.trim().replace(/\/$/, ''))
  })
)
app.use(express.json())

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/v1/municipalities', municipalitiesRoutes)
app.use('/api/v1/social/auth', socialAuthRoutes)
app.use('/api/v1/social-accounts', socialAccountsRoutes)
app.use('/api/v1/publications', publicationsRoutes)
app.use('/api/v1/analytics', analyticsRoutes)

// Error handling
app.use(errorHandler)

export { app }
