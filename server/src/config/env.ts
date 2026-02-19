import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  MOOV_ACCOUNT_ID: z.string().optional(),
  MOOV_PUBLIC_KEY: z.string().optional(),
  MOOV_SECRET_KEY: z.string().optional(),
  MOOV_WEBHOOK_SECRET: z.string().optional(),
  MARQETA_BASE_URL: z.string().url().optional(),
  MARQETA_APP_TOKEN: z.string().optional(),
  MARQETA_ADMIN_TOKEN: z.string().optional(),
  MARQETA_CARD_PRODUCT_TOKEN: z.string().optional(),
  MARQETA_FUNDING_SOURCE_TOKEN: z.string().optional(),
  PORT: z.string().default('4000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
})

function loadEnv() {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('Invalid environment variables:')
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    })
    process.exit(1)
  }
  return result.data
}

export const env = loadEnv()
