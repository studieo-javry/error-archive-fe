<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const store = useAuthStore()
const router = useRouter()
const route = useRoute()
const { startOAuthFlow, handleCallback, loginAsGuest } = useAuth()
const rememberMe = ref(true)
const loading = ref(false)
const guestLoading = ref(false)
const guestError = ref(false)

if (store.isAuthenticated) {
  router.replace((route.query.redirect as string) || '/home')
}

const isOfflineMode = import.meta.env.VITE_OFFLINE_MODE === 'true'

async function handleLogin() {
  loading.value = true
  const redirectPath = (route.query.redirect as string) || '/home'
  sessionStorage.setItem('oauth_return_url', redirectPath)
  try {
    if (isOfflineMode) {
      await handleCallback('mock-oauth-code', 'mock-state')
      return
    }
    await startOAuthFlow(rememberMe.value)
  } catch {
    loading.value = false
  }
}

async function handleGuest() {
  guestLoading.value = true
  guestError.value = false
  try {
    await loginAsGuest()
  } catch {
    guestError.value = true
    guestLoading.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div class="text-4xl text-emerald-500 mb-4 serif-title font-bold">E</div>
      <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100 mb-2">ErrorArchive</h1>
      <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-8">Track, share, and resolve errors together</p>

      <label class="flex items-center justify-center gap-2 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        <input v-model="rememberMe" type="checkbox" class="custom-checkbox" />
        자동 로그인 유지
      </label>

      <button
        class="px-6 py-3 text-sm font-medium rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
        :disabled="loading"
        @click="handleLogin"
      >
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
        {{ loading ? 'Redirecting...' : 'Sign in with GitHub' }}
      </button>

      <!-- 회원가입 없이 둘러보기 — 면접관/인사담당자용 데모 진입 -->
      <div class="flex items-center gap-3 my-5 w-64 mx-auto">
        <span class="flex-1 h-px bg-zinc-200 dark:bg-zinc-700"></span>
        <span class="text-[11px] text-zinc-400 dark:text-zinc-500">또는</span>
        <span class="flex-1 h-px bg-zinc-200 dark:bg-zinc-700"></span>
      </div>

      <button
        class="px-6 py-3 text-sm font-medium rounded-xl border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
        :disabled="guestLoading"
        @click="handleGuest"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        {{ guestLoading ? '들어가는 중...' : '로그인 없이 둘러보기' }}
      </button>
      <p class="mt-2.5 text-[11px] text-zinc-400 dark:text-zinc-500 max-w-[16rem] mx-auto leading-relaxed">
        가입 없이 데모 워크스페이스를 둘러볼 수 있어요. 변경사항은 매일 초기화됩니다.
      </p>
      <p v-if="guestError" class="mt-2 text-[11px] text-rose-500">둘러보기를 시작할 수 없어요. 잠시 후 다시 시도해주세요.</p>

      <p v-if="isOfflineMode" class="mt-4 text-[11px] text-zinc-400 dark:text-zinc-500">
        Offline mode — mock login enabled
      </p>
    </div>
  </div>
</template>
