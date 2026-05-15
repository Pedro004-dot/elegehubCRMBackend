import { app } from './infrastructure/http/server.js'
import { env } from './infrastructure/config/env.js'
import { scheduledPostsWorker } from './infrastructure/jobs/ScheduledPostsWorker.js'
import cors from 'cors';
app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`)
  console.log(`Health check: http://localhost:${env.PORT}/api/v1/health`)

  // Iniciar worker de publicações agendadas
  scheduledPostsWorker.start()
})

app.use(cors({
  origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)
// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...')
  scheduledPostsWorker.stop()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...')
  scheduledPostsWorker.stop()
  process.exit(0)
})
