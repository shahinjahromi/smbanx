import React, { createContext, useCallback, useEffect, useReducer, useRef } from 'react'
import { login as apiLogin, logout as apiLogout, refresh as apiRefresh } from '../api/auth'
import { setAccessToken } from '../api/axios'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  userId: string | null
  email: string | null
}

type AuthAction =
  | { type: 'LOGIN'; payload: { userId: string; email: string } }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }

function reducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN':
      return {
        ...state,
        isAuthenticated: true,
        isLoading: false,
        userId: action.payload.userId,
        email: action.payload.email,
      }
    case 'LOGOUT':
      return {
        isAuthenticated: false,
        isLoading: false,
        userId: null,
        email: null,
      }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    default:
      return state
  }
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function parseJwtPayload(token: string): { userId: string; email: string } | null {
  try {
    const base64 = token.split('.')[1]
    const decoded = JSON.parse(atob(base64))
    return { userId: decoded.userId, email: decoded.email }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    isAuthenticated: false,
    isLoading: true,
    userId: null,
    email: null,
  })

  // Refresh interval ref
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRefreshInterval = useCallback((token: string) => {
    if (refreshInterval.current) clearInterval(refreshInterval.current)
    // Refresh 1 minute before expiry (14 min for 15 min tokens)
    refreshInterval.current = setInterval(async () => {
      try {
        const { accessToken } = await apiRefresh()
        setAccessToken(accessToken)
        const payload = parseJwtPayload(accessToken)
        if (payload) {
          dispatch({ type: 'LOGIN', payload })
        }
      } catch {
        dispatch({ type: 'LOGOUT' })
        setAccessToken(null)
      }
    }, 14 * 60 * 1000)
  }, [])

  const stopRefreshInterval = useCallback(() => {
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current)
      refreshInterval.current = null
    }
  }, [])

  // Try to restore session on mount
  useEffect(() => {
    let cancelled = false

    async function tryRestore() {
      try {
        const { accessToken } = await apiRefresh()
        if (cancelled) return
        setAccessToken(accessToken)
        const payload = parseJwtPayload(accessToken)
        if (payload) {
          dispatch({ type: 'LOGIN', payload })
          startRefreshInterval(accessToken)
        } else {
          dispatch({ type: 'LOGOUT' })
        }
      } catch {
        if (!cancelled) dispatch({ type: 'LOGOUT' })
      }
    }

    tryRestore()
    return () => {
      cancelled = true
    }
  }, [startRefreshInterval])

  // Listen for auth:logout events from axios interceptor
  useEffect(() => {
    function handleLogout() {
      stopRefreshInterval()
      setAccessToken(null)
      dispatch({ type: 'LOGOUT' })
    }
    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [stopRefreshInterval])

  const login = useCallback(
    async (email: string, password: string) => {
      const { accessToken } = await apiLogin(email, password)
      setAccessToken(accessToken)
      const payload = parseJwtPayload(accessToken)
      if (!payload) throw new Error('Invalid token received')
      dispatch({ type: 'LOGIN', payload })
      startRefreshInterval(accessToken)
    },
    [startRefreshInterval],
  )

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // Ignore errors on logout
    }
    stopRefreshInterval()
    setAccessToken(null)
    dispatch({ type: 'LOGOUT' })
  }, [stopRefreshInterval])

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
