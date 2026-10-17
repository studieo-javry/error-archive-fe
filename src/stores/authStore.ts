import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MyProfile } from '@/types/user'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<MyProfile | null>(null)
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'))
  const userId = ref<number | null>(null)
  // "로그인 없이 둘러보기" 세션 여부. 새로고침에도 유지되도록 localStorage 에 보존(데모 배너/금지 UI 유지).
  const isGuest = ref<boolean>(localStorage.getItem('isGuest') === 'true')

  const isAuthenticated = computed(() => !!accessToken.value)

  function setAccessToken(token: string) {
    accessToken.value = token
    localStorage.setItem('accessToken', token)
  }

  function setGuest(value: boolean) {
    isGuest.value = value
    if (value) localStorage.setItem('isGuest', 'true')
    else localStorage.removeItem('isGuest')
  }

  function setUser(profile: MyProfile) {
    user.value = profile
  }

  function logout() {
    user.value = null
    accessToken.value = null
    userId.value = null
    setGuest(false)
    localStorage.removeItem('accessToken')
  }

  return { user, accessToken, userId, isGuest, isAuthenticated, setAccessToken, setGuest, setUser, logout }
})
