import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/services/authApi'
import { useRouter } from 'vue-router'

export function useAuth() {
  const store = useAuthStore()
  const router = useRouter()

  async function startOAuthFlow(rememberMe: boolean) {
    const redirectUri = import.meta.env.VITE_GITHUB_REDIRECT_URI
    sessionStorage.setItem('oauth_remember_me', String(rememberMe))
    sessionStorage.setItem('oauth_redirect_uri', redirectUri)

    const { data } = await authApi.authorize(redirectUri)
    window.location.href = data.authorizationUrl
  }

  async function handleCallback(code: string, state: string) {
    const redirectUri = sessionStorage.getItem('oauth_redirect_uri') || import.meta.env.VITE_GITHUB_REDIRECT_URI
    const rememberMe = sessionStorage.getItem('oauth_remember_me') !== 'false'
    sessionStorage.removeItem('oauth_redirect_uri')
    sessionStorage.removeItem('oauth_remember_me')

    const { data } = await authApi.callback(code, state, redirectUri, rememberMe)
    store.setAccessToken(data.accessToken)
    store.userId = data.userId

    await fetchUser()
    const returnUrl = sessionStorage.getItem('oauth_return_url') || '/'
    sessionStorage.removeItem('oauth_return_url')
    router.push(returnUrl)
  }

  async function fetchUser() {
    if (!store.isAuthenticated) return
    const { data } = await authApi.getMe()
    store.setUser(data)
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      store.logout()
      router.push('/login')
    }
  }

  return { startOAuthFlow, handleCallback, fetchUser, logout }
}
