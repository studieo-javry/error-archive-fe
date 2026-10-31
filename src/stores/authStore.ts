import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MyProfile, DemoArticle } from '@/types/user'
import { clearRefCache } from '@/utils/githubRefCache'

function loadDemoArticle(): DemoArticle | null {
  try {
    const raw = localStorage.getItem('guestDemoArticle')
    return raw ? (JSON.parse(raw) as DemoArticle) : null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<MyProfile | null>(null)
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'))
  const userId = ref<number | null>(null)
  // "로그인 없이 둘러보기" 세션 여부. 새로고침에도 유지되도록 localStorage 에 보존(데모 배너/금지 UI 유지).
  const isGuest = ref<boolean>(localStorage.getItem('isGuest') === 'true')
  // 게스트 세션 만료 시각(ISO). /auth/guest 의 accessTokenExpiresAt — 데모 타이머·만료 오버레이가 사용.
  const guestExpiresAt = ref<string | null>(localStorage.getItem('guestExpiresAt'))
  // 데모 시드 케이스의 공개 아티클(가이드 4단계). BE 가 내려줄 때만 존재.
  const guestDemoArticle = ref<DemoArticle | null>(loadDemoArticle())

  const isAuthenticated = computed(() => !!accessToken.value)

  function setAccessToken(token: string) {
    accessToken.value = token
    localStorage.setItem('accessToken', token)
  }

  function setGuestDemoArticle(article: DemoArticle | null) {
    guestDemoArticle.value = article
    if (article) localStorage.setItem('guestDemoArticle', JSON.stringify(article))
    else localStorage.removeItem('guestDemoArticle')
  }

  function setGuest(value: boolean, expiresAt?: string | null) {
    isGuest.value = value
    if (value) {
      localStorage.setItem('isGuest', 'true')
      if (expiresAt) {
        guestExpiresAt.value = expiresAt
        localStorage.setItem('guestExpiresAt', expiresAt)
      }
    } else {
      localStorage.removeItem('isGuest')
      guestExpiresAt.value = null
      localStorage.removeItem('guestExpiresAt')
      setGuestDemoArticle(null)
    }
  }

  function setUser(profile: MyProfile) {
    user.value = profile
  }

  function logout() {
    clearRefCache()
    user.value = null
    accessToken.value = null
    userId.value = null
    setGuest(false)
    localStorage.removeItem('accessToken')
  }

  return { user, accessToken, userId, isGuest, guestExpiresAt, guestDemoArticle, isAuthenticated, setAccessToken, setGuest, setGuestDemoArticle, setUser, logout }
})
