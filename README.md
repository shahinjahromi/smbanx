# Banking MVP

Small business banking app with account dashboards, internal transfers, transaction history, and JWT-based session management.

## Prerequisites

- Node.js 18+
- PostgreSQL running locally
- Stripe account (test mode) + Stripe CLI

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp server/.env.example server/.env
# Edit server/.env with your actual values:
#   DATABASE_URL       — PostgreSQL connection string
#   JWT_ACCESS_SECRET  — 32+ char random string
#   JWT_REFRESH_SECRET — 32+ char random string
#   STRIPE_SECRET_KEY  — sk_test_... from Stripe dashboard
#   STRIPE_WEBHOOK_SECRET — whsec_... from stripe listen output
```

### 3. Run database migrations
```bash
npm run db:migrate
```

### 4. Seed demo data
```bash
npm run db:seed
```

### 5. Start Stripe webhook forwarding (separate terminal)
```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
# Copy the whsec_... secret into server/.env STRIPE_WEBHOOK_SECRET
```

### 6. Start dev servers
```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## Demo credentials

| User | Email | Password |
|------|-------|----------|
| Alice Johnson (Acme Corp) | alice@acmecorp.com | demo1234 |
| Bob Smith (TechStart Inc.) | bob@techstart.io | demo1234 |

## Other commands

```bash
npm run db:studio   # Open Prisma Studio at port 5555
```

## Architecture

- **Auth**: 15-min JWT access token in React memory + 7-day refresh token in httpOnly cookie
- **Transfers**: Stripe PaymentIntent (test mode) → confirm server-side → atomic balance update
- **No real money moves** — Stripe test mode only
