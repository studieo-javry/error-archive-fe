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

/**
 * Single-flight refresh. Concurrent 401s (a page load fires several requests at once, all
 * expiring together) must NOT each POST /auth/refresh with the same cookie: the server rotates
 * the refresh token and treats a *second* presentation of the now-revoked token as reuse,
 * revoking the whole session family → the user is logged out despite a valid remember-me cookie.
 * So all callers share one in-flight promise: exactly one rotation happens, the rest await it.
 *
 * Uses apiClient (not bare axios) so it hits API_BASE (e.g. https://api.error-archive.com/api/v1)
 * with credentials — a relative bare-axios call would resolve against the document origin, where
 * no refresh endpoint exists. The interceptor's `isRefreshCall` guard prevents recursion.
 */
let refreshInFlight: Promise<string> | null = null

function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = apiClient
      .post<{ accessToken: string }>('/auth/refresh')
      .then(({ data }) => {
        localStorage.setItem('accessToken', data.accessToken)
        return data.accessToken
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
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
        const accessToken = await refreshAccessToken()
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return apiClient(originalRequest)
      } catch {
        handleAuthFailure()
      }
    }
    return Promise.reject(error)
  },
)

export default apiClient
