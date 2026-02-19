import api from './axios'
import type { Card } from '../types'

export async function fetchCards(): Promise<Card[]> {
  const { data } = await api.get<Card[]>('/cards')
  return data
}

export async function fetchCard(id: string): Promise<Card> {
  const { data } = await api.get<Card>(`/cards/${id}`)
  return data
}
