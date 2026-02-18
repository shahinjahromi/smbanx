import { Moov } from '@moovio/node'
import { env } from './env'

export const moov = new Moov({
  accountID: env.MOOV_ACCOUNT_ID ?? '',
  publicKey: env.MOOV_PUBLIC_KEY ?? '',
  secretKey: env.MOOV_SECRET_KEY ?? '',
  domain: 'https://localhost',
})
