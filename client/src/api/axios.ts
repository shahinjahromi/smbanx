import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// In-memory access token storage
let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

// Queue for requests waiting on token refresh
let isRefreshing = false
let refreshSubscribers: ((token: string) => void)[] = []

function subscribeToRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb)
}

function notifyRefreshSubscribers(token: string) {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

function rejectRefreshSubscribers(err: unknown) {
  refreshSubscribers.forEach((_, __, arr) => {
    // Clear all, they will reject
    arr.splice(0, arr.length)
  })
  refreshSubscribers = []
}

// Attach access token to every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// On 401, attempt silent refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    // Skip refresh for auth endpoints themselves
    const url = originalRequest.url ?? ''
    if (url.includes('/auth/refresh') || url.includes('/auth/login')) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    if (isRefreshing) {
      // Queue this request until refresh completes
      return new Promise((resolve, reject) => {
        subscribeToRefresh((token) => {
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${token}`
          } else {
            originalRequest.headers = { Authorization: `Bearer ${token}` }
          }
          resolve(api(originalRequest))
        })
      })
    }

    isRefreshing = true

    try {
      const { data } = await api.post<{ accessToken: string }>('/auth/refresh')
      const newToken = data.accessToken
      setAccessToken(newToken)
      notifyRefreshSubscribers(newToken)

      if (originalRequest.headers) {
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`
      } else {
        originalRequest.headers = { Authorization: `Bearer ${newToken}` }
      }

      return api(originalRequest)
    } catch (refreshError) {
      rejectRefreshSubscribers(refreshError)
      setAccessToken(null)
      // Dispatch a custom event so AuthContext can handle logout
      window.dispatchEvent(new CustomEvent('auth:logout'))
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default api
