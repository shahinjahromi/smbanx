import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import { env } from './config/env'
import { errorHandler } from './middleware/errorHandler'
import { apiLimiter } from './middleware/rateLimiter'

import authRoutes from './routes/auth'
import accountsRoutes from './routes/accounts'
import transactionsRoutes from './routes/transactions'
import transfersRoutes from './routes/transfers'
import webhooksRoutes from './routes/webhooks'
import cardsRoutes from './routes/cards'
import simulatorRoutes from './routes/simulator'

const app = express()

// Security headers
app.use(helmet())

// CORS
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
)

// Cookie parser
app.use(cookieParser())

// Webhook route needs raw body BEFORE json parser
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRoutes)

// JSON body parser for all other routes
app.use(express.json())

// Rate limiter for API routes
app.use('/api', apiLimiter)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/accounts', accountsRoutes)
app.use('/api/transactions', transactionsRoutes)
app.use('/api/transfers', transfersRoutes)
app.use('/api/cards', cardsRoutes)
app.use('/api/simulator', simulatorRoutes)

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Error handler (must be last)
app.use(errorHandler)

app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`)
  console.log(`Environment: ${env.NODE_ENV}`)
})

export default app
