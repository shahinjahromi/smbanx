import api from './axios'

export interface LoginResponse {
  accessToken: string
  expiresAt: string
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
  return data
}

export async function refresh(): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/refresh')
  return data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}
