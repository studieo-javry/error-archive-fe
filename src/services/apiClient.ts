import axios from 'axios'
import router from '@/router'
import { useAuthStore } from '@/stores/authStore'
import { API_BASE } from './apiBase'

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Paths that must remain reachable while logged out — never bounce these to /login.
function isPublicPath(path: string): boolean {
  return path === '/' || path === '/login' || path === '/auth/callback' || path.startsWith('/report/')
}

/**
 * The session is gone (refresh failed). Drop the stale token and, only when we're on a
 * protected route, send the user to login via the router (NOT window.location — a hard
 * reload here re-mounts the page, re-fires the failing request, and loops forever).
 * The path check uses window.location so it's correct even before the initial route resolves.
 */
function handleAuthFailure() {
  useAuthStore().logout()
  if (!isPublicPath(window.location.pathname)) {
    router.replace({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const isRefreshCall = !!originalRequest?.url?.includes('/auth/refresh')
    // Only an *authenticated* session (token present) whose access token expired should refresh.
    // For requests made while logged out (no token), a 401 is expected — refreshing would just
    // 401 again and bounce public pages (landing/login) into a redirect-reload loop.
    const wasAuthenticated = !!localStorage.getItem('accessToken')

    if (error.response?.status === 401 && wasAuthenticated && !isRefreshCall && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const { data } = await axios.post<{ accessToken: string }>('/api/v1/auth/refresh', null, {
          withCredentials: true,
        })
        localStorage.setItem('accessToken', data.accessToken)
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
        return apiClient(originalRequest)
      } catch {
        handleAuthFailure()
      }
    }
    return Promise.reject(error)
  },
)

export default apiClient
