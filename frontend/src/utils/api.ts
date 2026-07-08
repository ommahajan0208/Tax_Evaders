import axios from 'axios'
import { useAuthStore } from '../store/authStore'

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request Interceptor: Attach JWT bearer token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response Interceptor: Auto-refresh tokens on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    // Check if error is 401 Unauthorized and request hasn't been retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      const refreshToken = useAuthStore.getState().refreshToken
      if (refreshToken) {
        try {
          // Request a new access token
          // Note: using direct axios call to avoid request interceptor loops
          const res = await axios.post('/api/auth/refresh', { refresh_token: refreshToken })
          const data = res.data
          
          // Update Zustand store
          useAuthStore.getState().setAuth({
            token: data.access_token,
            refreshToken: data.refresh_token,
            username: data.username,
            role: data.role
          })
          
          // Retry the original request with the new token
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`
          return api(originalRequest)
        } catch (refreshError) {
          // Refresh token is expired or invalid -> log out
          useAuthStore.getState().clearAuth()
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      } else {
        // No refresh token available -> logout
        useAuthStore.getState().clearAuth()
        window.location.href = '/login'
      }
    }
    
    return Promise.reject(error)
  }
)
export default api
