import { PrismaClient, AccountType, TransactionType, TransactionStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─── Marqeta helpers (inline to avoid circular env dependency in seed) ────────
const MQ_BASE = process.env.MARQETA_BASE_URL ?? 'https://sandbox-api.marqeta.com/v3'
const MQ_AUTH = 'Basic ' + Buffer.from(
  `${process.env.MARQETA_APP_TOKEN}:${process.env.MARQETA_ADMIN_TOKEN}`
).toString('base64')

async function mqPost(path: string, body: object) {
  const res = await fetch(`${MQ_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: MQ_AUTH, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json() as Record<string, unknown>
  if (!res.ok && res.status !== 409) throw new Error(`Marqeta ${path} failed: ${JSON.stringify(json)}`)
  return json
}

async function mqGet(path: string) {
  const res = await fetch(`${MQ_BASE}${path}`, {
    headers: { Authorization: MQ_AUTH, Accept: 'application/json' },
  })
  const json = await res.json() as Record<string, unknown>
  if (!res.ok) throw new Error(`Marqeta GET ${path} failed: ${JSON.stringify(json)}`)
  return json
}

async function ensureMarqetaUser(token: string, firstName: string, lastName: string, email: string) {
  const res = await mqPost('/users', { token, first_name: firstName, last_name: lastName, email, active: true })
  if ((res as { token?: string }).token) return res
  // 409 — user already exists, fetch it
  return mqGet(`/users/${token}`)
}

async function createMarqetaCard(userToken: string) {
  const cardProductToken = process.env.MARQETA_CARD_PRODUCT_TOKEN
  return mqPost('/cards', { user_token: userToken, card_product_token: cardProductToken })
}

async function fundGPA(userToken: string, amountCents: number) {
  return mqPost('/gpaorders', {
    user_token: userToken,
    amount: amountCents / 100,
    currency_code: 'USD',
    funding_source_token: process.env.MARQETA_FUNDING_SOURCE_TOKEN ?? 'sandbox_program_funding',
  })
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function daysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

async function main() {
  console.log('Seeding database...')

  // Clean up
  await prisma.transaction.deleteMany()
  await prisma.card.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()

  const passwordHash = await bcrypt.hash('demo1234', 12)

  // Create Alice (Acme Corp)
  const alice = await prisma.user.create({
    data: {
      email: 'alice@acmecorp.com',
      passwordHash,
      firstName: 'Alice',
      lastName: 'Johnson',
      businessName: 'Acme Corp',
    },
  })

  // Create Bob (TechStart)
  const bob = await prisma.user.create({
    data: {
      email: 'bob@techstart.io',
      passwordHash,
      firstName: 'Bob',
      lastName: 'Smith',
      businessName: 'TechStart Inc.',
    },
  })

  // Alice's accounts
  const aliceChecking = await prisma.account.create({
    data: {
      userId: alice.id,
      accountNumber: '4001-0001-0001',
      accountType: AccountType.CHECKING,
      name: 'Business Checking',
      balanceCents: 2_450_000, // $24,500.00
      currency: 'USD',
    },
  })

  const aliceSavings = await prisma.account.create({
    data: {
      userId: alice.id,
      accountNumber: '4001-0001-0002',
      accountType: AccountType.SAVINGS,
      name: 'Business Savings',
      balanceCents: 10_000_000, // $100,000.00
      currency: 'USD',
    },
  })

  const aliceBusiness = await prisma.account.create({
    data: {
      userId: alice.id,
      accountNumber: '4001-0001-0003',
      accountType: AccountType.BUSINESS,
      name: 'Operating Account',
      balanceCents: 5_750_000, // $57,500.00
      currency: 'USD',
    },
  })

  // Bob's accounts
  const bobChecking = await prisma.account.create({
    data: {
      userId: bob.id,
      accountNumber: '4002-0001-0001',
      accountType: AccountType.CHECKING,
      name: 'Main Checking',
      balanceCents: 1_200_000, // $12,000.00
      currency: 'USD',
    },
  })

  const bobBusiness = await prisma.account.create({
    data: {
      userId: bob.id,
      accountNumber: '4002-0001-0002',
      accountType: AccountType.BUSINESS,
      name: 'Startup Account',
      balanceCents: 8_300_000, // $83,000.00
      currency: 'USD',
    },
  })

  console.log('Created users and accounts...')

  // ─── Marqeta integration ─────────────────────────────────────────────────
  console.log('Provisioning Marqeta users, funding GPAs, and issuing cards...')

  // Alice
  const mqAlice = await ensureMarqetaUser('banking-mvp-alice', 'Alice', 'Johnson', 'alice@acmecorp.com')
  await fundGPA('banking-mvp-alice', aliceChecking.balanceCents)
  const mqAliceCard = await createMarqetaCard('banking-mvp-alice') as { token: string; last_four: string; expiration: string }

  // Bob
  const mqBob = await ensureMarqetaUser('banking-mvp-bob', 'Bob', 'Smith', 'bob@techstart.io')
  await fundGPA('banking-mvp-bob', bobChecking.balanceCents)
  const mqBobCard = await createMarqetaCard('banking-mvp-bob') as { token: string; last_four: string; expiration: string }

  // Store Marqeta tokens in DB
  await prisma.user.update({ where: { id: alice.id }, data: { marqetaUserToken: mqAlice.token as string } })
  await prisma.user.update({ where: { id: bob.id }, data: { marqetaUserToken: mqBob.token as string } })

  // Parse expiry MMYY → month + year (20YY)
  function parseExpiry(mmyy: string) {
    const month = parseInt(mmyy.slice(0, 2), 10)
    const year = 2000 + parseInt(mmyy.slice(2, 4), 10)
    return { month, year }
  }

  const aliceExpiry = parseExpiry(mqAliceCard.expiration)
  const bobExpiry = parseExpiry(mqBobCard.expiration)

  // Create local Card records with Marqeta tokens
  await prisma.card.create({
    data: {
      accountId: aliceChecking.id,
      last4: mqAliceCard.last_four,
      expiryMonth: aliceExpiry.month,
      expiryYear: aliceExpiry.year,
      marqetaCardToken: mqAliceCard.token,
    },
  })
  await prisma.card.create({
    data: {
      accountId: bobChecking.id,
      last4: mqBobCard.last_four,
      expiryMonth: bobExpiry.month,
      expiryYear: bobExpiry.year,
      marqetaCardToken: mqBobCard.token,
    },
  })

  console.log(`Marqeta Alice: user=${mqAlice.token} card=••••${mqAliceCard.last_four}`)
  console.log(`Marqeta Bob:   user=${mqBob.token} card=••••${mqBobCard.last_four}`)

  // Generate 90 days of transaction history
  const memos = [
    'Office supplies',
    'Client payment received',
    'Software subscription',
    'Monthly payroll',
    'Vendor payment',
    'Marketing expenses',
    'Cloud hosting fees',
    'Equipment purchase',
    'Professional services',
    'Tax payment',
    'Consulting fee',
    'Refund received',
    'Insurance premium',
    'Utilities',
    'Travel expenses',
  ]

  const transactions: {
    fromAccountId: string | null
    toAccountId: string | null
    amountCents: number
    type: TransactionType
    status: TransactionStatus
    memo: string
    createdAt: Date
  }[] = []

  // Generate historical transactions for Alice
  for (let day = 90; day >= 5; day--) {
    const txCount = randomInt(1, 4)
    for (let i = 0; i < txCount; i++) {
      const amount = randomInt(5000, 500000) // $50 to $5,000
      const memo = memos[randomInt(0, memos.length - 1)]
      const isIncoming = Math.random() > 0.5

      transactions.push({
        fromAccountId: isIncoming ? null : aliceChecking.id,
        toAccountId: isIncoming ? aliceChecking.id : null,
        amountCents: amount,
        type: isIncoming ? 'CREDIT' : 'DEBIT',
        status: 'COMPLETED',
        memo,
        createdAt: daysAgo(day),
      })
    }
  }

  // Internal transfers between Alice's accounts
  for (let day = 80; day >= 10; day -= 15) {
    const amount = randomInt(100000, 1000000) // $1,000 to $10,000
    transactions.push({
      fromAccountId: aliceChecking.id,
      toAccountId: aliceSavings.id,
      amountCents: amount,
      type: 'DEBIT',
      status: 'COMPLETED',
      memo: 'Transfer to savings',
      createdAt: daysAgo(day),
    })
  }

  // Generate historical transactions for Bob
  for (let day = 90; day >= 5; day--) {
    const txCount = randomInt(1, 3)
    for (let i = 0; i < txCount; i++) {
      const amount = randomInt(10000, 300000)
      const memo = memos[randomInt(0, memos.length - 1)]
      const isIncoming = Math.random() > 0.4

      transactions.push({
        fromAccountId: isIncoming ? null : bobChecking.id,
        toAccountId: isIncoming ? bobChecking.id : null,
        amountCents: amount,
        type: isIncoming ? 'CREDIT' : 'DEBIT',
        status: 'COMPLETED',
        memo,
        createdAt: daysAgo(day),
      })
    }
  }

  // A few PENDING transactions
  transactions.push(
    {
      fromAccountId: aliceChecking.id,
      toAccountId: bobChecking.id,
      amountCents: 250000, // $2,500
      type: 'DEBIT',
      status: 'PENDING',
      memo: 'Consulting services Q1',
      createdAt: daysAgo(1),
    },
    {
      fromAccountId: aliceBusiness.id,
      toAccountId: aliceSavings.id,
      amountCents: 500000, // $5,000
      type: 'DEBIT',
      status: 'PENDING',
      memo: 'Quarterly savings transfer',
      createdAt: daysAgo(0),
    },
    {
      fromAccountId: bobBusiness.id,
      toAccountId: bobChecking.id,
      amountCents: 150000, // $1,500
      type: 'DEBIT',
      status: 'PENDING',
      memo: 'Operating expenses reimbursement',
      createdAt: daysAgo(0),
    },
  )

  // Bulk insert transactions
  await prisma.$transaction(
    transactions.map((tx) =>
      prisma.transaction.create({
        data: tx,
      }),
    ),
  )

  console.log(`Created ${transactions.length} transactions`)
  console.log('\nSeed complete!')
  console.log('\nDemo credentials:')
  console.log('  alice@acmecorp.com / demo1234')
  console.log('  bob@techstart.io / demo1234')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
