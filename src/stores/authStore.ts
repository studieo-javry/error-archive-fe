import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserProfile } from '@/types/user'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null)
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'))
  const userId = ref<number | null>(null)

  const isAuthenticated = computed(() => !!accessToken.value)

  function setAccessToken(token: string) {
    accessToken.value = token
    localStorage.setItem('accessToken', token)
  }

  function setUser(profile: UserProfile) {
    user.value = profile
  }

  function logout() {
    user.value = null
    accessToken.value = null
    userId.value = null
    localStorage.removeItem('accessToken')
  }

  return { user, accessToken, userId, isAuthenticated, setAccessToken, setUser, logout }
})
