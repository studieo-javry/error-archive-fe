import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/services/authApi'
import { useRouter } from 'vue-router'
import { useTourStore } from '@/stores/tourStore'

export function useAuth() {
  const store = useAuthStore()
  const router = useRouter()
  // 사용 가이드 진행 상태는 localStorage 에 남으므로, 세션이 바뀌는 지점마다 처음 상태로 되돌린다.
  const tourStore = useTourStore()

  async function startOAuthFlow(rememberMe: boolean) {
    const redirectUri = import.meta.env.VITE_GITHUB_REDIRECT_URI
    const returnUrl = sessionStorage.getItem('oauth_return_url') || '/home'
    sessionStorage.setItem('oauth_remember_me', String(rememberMe))
    sessionStorage.setItem('oauth_redirect_uri', redirectUri)

    const { data } = await authApi.authorize(redirectUri, returnUrl)
    window.location.href = data.authorizationUrl
  }

  async function handleCallback(code: string, state: string) {
    const redirectUri = sessionStorage.getItem('oauth_redirect_uri') || import.meta.env.VITE_GITHUB_REDIRECT_URI
    const rememberMe = sessionStorage.getItem('oauth_remember_me') !== 'false'
    sessionStorage.removeItem('oauth_redirect_uri')
    sessionStorage.removeItem('oauth_remember_me')
    sessionStorage.removeItem('oauth_return_url')

    const { data } = await authApi.callback(code, state, redirectUri, rememberMe)
    store.setAccessToken(data.accessToken)
    // 실제 로그인/가입이 성립하면 게스트 플래그를 반드시 해제(게스트 → 가입 전환 시 데모 배너 잔존 방지).
    store.setGuest(false)
    tourStore.reset()

    await fetchUser()
    router.push(data.redirectTo || '/home')
  }

  /**
   * 게스트(데모) → 회원가입 전환. 게스트는 이미 인증 상태(토큰 보유)라 그대로 /login 으로 보내면
   * LoginPage 의 `isAuthenticated` 가드가 즉시 되튕긴다 → 먼저 로컬 세션/게스트 플래그를 비운 뒤
   * 로그인(= GitHub OAuth 회원가입) 화면으로 보낸다. 서버 로그아웃에 의존하지 않는다(게스트 토큰은 곧 만료).
   */
  function startSignup() {
    if (store.isGuest) store.logout()
    tourStore.reset()
    router.push({ name: 'login' })
  }

  async function loginAsGuest() {
    const { data } = await authApi.guest()
    store.setAccessToken(data.accessToken)
    // 실제 세션 수명(accessTokenExpiresAt)을 보존 → 데모 타이머/만료 오버레이가 사용.
    store.setGuest(true, data.accessTokenExpiresAt)
    tourStore.reset()

    await fetchUser()
    // 게스트는 데모 워크스페이스의 '홈'으로 진입 — 홈의 게스트 환영 카드(GuestWelcomeCard)에서
    // '가이드 시작하기'로 자연스럽게 투어로 이어지도록. (가이드 1단계가 다시 Library 로 데려간다.)
    router.push(`/w/${data.workspaceSlug}/home`)
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
      tourStore.reset()
      router.push('/login')
    }
  }

  return { startOAuthFlow, handleCallback, loginAsGuest, startSignup, fetchUser, logout }
}
