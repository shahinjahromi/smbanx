import api from './axios'
import type { Account } from '../types'

export async function fetchAccounts(): Promise<Account[]> {
  const { data } = await api.get<{ accounts: Account[] }>('/accounts')
  return data.accounts
}

export async function fetchAccount(id: string): Promise<Account> {
  const { data } = await api.get<{ account: Account }>(`/accounts/${id}`)
  return data.account
}

export async function fetchMoovDestinations(): Promise<Account[]> {
  const { data } = await api.get<{ accounts: Account[] }>('/accounts/moov-destinations')
  return data.accounts
}

export async function fetchNymbusDestinations(): Promise<Account[]> {
  const { data } = await api.get<{ destinations: Account[] }>('/accounts/nymbus-destinations')
  return data.destinations
}
