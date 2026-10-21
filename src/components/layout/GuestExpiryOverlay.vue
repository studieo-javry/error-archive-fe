<script setup lang="ts">
import { ref } from 'vue'
import { useGuestSession } from '@/composables/useGuestSession'
import { useAuth } from '@/composables/useAuth'

const { isExpired } = useGuestSession()
const { loginAsGuest, startSignup } = useAuth()
const restarting = ref(false)

// 만료 시점이 전환(가입) 유도의 핵심 순간 — 게스트 세션 정리 후 로그인/가입 화면으로.
const goSignup = startSignup

async function restart() {
  if (restarting.value) return
  restarting.value = true
  try {
    await loginAsGuest() // 새 게스트 세션 발급 + 데모 워크스페이스로 이동
  } finally {
    restarting.value = false
  }
}
</script>

<template>
  <div
    v-if="isExpired"
    class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="guest-expiry-title"
  >
    <div class="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl p-7 text-center">
      <p class="font-mono text-[10px] tracking-widest uppercase text-emerald-600 dark:text-emerald-500 mb-3">Demo ended</p>
      <h2 id="guest-expiry-title" class="serif-title text-2xl font-light text-zinc-900 dark:text-zinc-100 mb-3">
        데모 시간이 끝났어요.
      </h2>
      <p class="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
        가입하면 지금까지 둘러본 흐름 그대로, 내 워크스페이스에서 에러를 기록하고 해결 과정을 이어갈 수 있어요.
      </p>
      <div class="flex flex-col gap-2">
        <button
          type="button"
          class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-emerald-700 transition-colors"
          @click="goSignup"
        >
          가입하기
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14m-5-5 5 5-5 5" />
          </svg>
        </button>
        <button
          type="button"
          :disabled="restarting"
          class="rounded-xl px-5 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-60"
          @click="restart"
        >
          {{ restarting ? '다시 시작하는 중…' : '데모 다시 시작하기' }}
        </button>
      </div>
      <p class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-4">GitHub 계정으로 간편하게 시작하세요.</p>
    </div>
  </div>
</template>
