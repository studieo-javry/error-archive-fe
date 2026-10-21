<script setup lang="ts">
import { useAuth } from '@/composables/useAuth'

// 게스트 세션을 정리하고 로그인(= GitHub 회원가입) 화면으로.
const { startSignup: goSignup } = useAuth()
</script>

<template>
  <section class="mb-16 rounded-2xl border border-emerald-200/70 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-zinc-900 p-7 md:p-8">
    <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
      <div class="max-w-xl">
        <p class="font-mono text-[10px] tracking-widest uppercase text-emerald-600 dark:text-emerald-500 mb-3">Guest demo</p>
        <h2 class="serif-title text-2xl md:text-3xl font-light text-zinc-900 dark:text-zinc-100 tracking-tight mb-3 leading-snug">
          하나의 에러가<br>해결 기록이 되기까지.
        </h2>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
          샘플 케이스로 시도를 남기고, 솔루션을 찾고, 글로 공유하는 흐름을 둘러보세요.
          가입하면 내 워크스페이스에서 그대로 이어갈 수 있어요.
        </p>
      </div>
      <div class="shrink-0 md:text-center">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-emerald-700 transition-colors"
          @click="goSignup"
        >
          가입하기
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14m-5-5 5 5-5 5" />
          </svg>
        </button>
        <p class="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">GitHub 계정으로 간편하게</p>
      </div>
    </div>
  </section>
</template>
