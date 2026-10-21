<script setup lang="ts">
import { ClockIcon } from '@heroicons/vue/24/outline'
import { useGuestSession } from '@/composables/useGuestSession'
import { useAuth } from '@/composables/useAuth'
import { useTour } from '@/composables/useTour'

const { remainingLabel } = useGuestSession()
// 게스트 세션을 정리하고 로그인(= GitHub 회원가입) 화면으로.
const { startSignup: goSignup } = useAuth()
// 사용 가이드(투어) 시작/재시작.
const { active: tourActive, start: startTour } = useTour()
</script>

<template>
  <div
    class="flex items-center justify-between gap-3 px-4 py-2 text-xs
           bg-emerald-50 text-emerald-900 border-b border-emerald-200
           dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900/50"
    role="status"
  >
    <div class="flex items-center gap-2 min-w-0">
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      <strong class="font-semibold shrink-0">게스트 모드</strong>
      <span class="text-emerald-800/80 dark:text-emerald-300/70 truncate">
        샘플 데이터로 자유롭게 둘러보세요.
        <span class="hidden sm:inline">파일 업로드·발행 등 일부 기능은 비활성화돼 있고, </span>변경사항은 매일 초기화돼요.
      </span>
    </div>

    <div class="flex items-center gap-3 shrink-0">
      <span
        v-if="remainingLabel"
        class="hidden sm:flex items-center gap-1 font-mono tabular-nums text-emerald-700/80 dark:text-emerald-300/70"
        title="데모 세션 남은 시간"
      >
        <ClockIcon class="w-3.5 h-3.5" />{{ remainingLabel }}
      </span>
      <button
        v-if="!tourActive"
        type="button"
        class="hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium text-emerald-800 hover:bg-emerald-100/70 dark:text-emerald-300 dark:hover:bg-emerald-900/40 transition-colors"
        @click="startTour"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m16 8-2 6-6 2 2-6 6-2Z" /></svg>
        사용 가이드
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white px-3 py-1 font-medium hover:bg-emerald-700 transition-colors"
        @click="goSignup"
      >
        가입하기
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5 12h14m-5-5 5 5-5 5" />
        </svg>
      </button>
    </div>
  </div>
</template>
