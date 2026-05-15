import { config } from 'dotenv'
import { z } from 'zod'

config()

const envSchema = z.object({
  // Server
  PORT: z.string().default('3000').transform(Number),
  API_BASE_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174,http://localhost:5175'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Meta (Facebook/Instagram)
  META_APP_ID: z.string().min(1).optional(),
  META_APP_SECRET: z.string().min(1).optional(),

  // TikTok
  TIKTOK_CLIENT_KEY: z.string().min(1).optional(),
  TIKTOK_CLIENT_SECRET: z.string().min(1).optional(),

  // Google (YouTube)
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

  // Security
  JWT_SECRET: z.string().min(32).optional(),
  TOKEN_ENCRYPTION_KEY: z.string().min(32).optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format())
  process.exit(1)
}

export const env = parsed.data
