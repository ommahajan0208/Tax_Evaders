import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  refreshToken: string | null
  username: string | null
  role: string | null
  isAuthenticated: boolean
  setAuth: (authData: { token: string; refreshToken: string; username: string; role: string }) => void
  clearAuth: () => void
  updateToken: (newToken: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      username: null,
      role: null,
      isAuthenticated: false,
      
      setAuth: (authData) => set({
        token: authData.token,
        refreshToken: authData.refreshToken,
        username: authData.username,
        role: authData.role,
        isAuthenticated: true
      }),
      
      clearAuth: () => set({
        token: null,
        refreshToken: null,
        username: null,
        role: null,
        isAuthenticated: false
      }),
      
      updateToken: (newToken) => set({ token: newToken })
    }),
    {
      name: 'sebi-agent-auth-storage', // localstorage key
    }
  )
)
