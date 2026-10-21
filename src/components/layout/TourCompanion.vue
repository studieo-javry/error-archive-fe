<script setup lang="ts">
import { watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useTour } from '@/composables/useTour'
import { useTourStore } from '@/stores/tourStore'
import { XMarkIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const tourStore = useTourStore()
const { active, current, stepIndex, isLast, TOUR_STEPS, next, prev, dismiss, convert } = useTour()

// ── 현재 스텝 대상 요소 강조 ───────────────────────────────────────────────
let highlighted: Element | null = null
function clearHighlight() {
  if (highlighted) {
    highlighted.classList.remove('tour-highlight')
    highlighted = null
  }
}
function selector(): string | null {
  const step = current.value
  if (!step || !step.anchor) return null
  // 케이스 목록에선 투어가 고른 그 케이스만 강조.
  if (step.key === 'case' && tourStore.caseId != null) return `[data-case-id="${tourStore.caseId}"]`
  return step.anchor
}
async function applyHighlight() {
  clearHighlight()
  if (!active.value) return
  const sel = selector()
  if (!sel) return
  await nextTick()
  // 라우트 전환 직후 렌더가 끝나길 잠깐 기다린다.
  window.setTimeout(() => {
    if (!active.value) return
    const el = document.querySelector(sel)
    if (!el) return
    el.classList.add('tour-highlight')
    highlighted = el
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, 120)
}

watch([() => tourStore.step, () => route.fullPath, active], applyHighlight, { flush: 'post' })
onMounted(applyHighlight)
onBeforeUnmount(clearHighlight)
</script>

<template>
  <aside
    v-if="active && current"
    class="fixed z-50 right-4 bottom-4 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl shadow-zinc-900/10 overflow-hidden"
    role="complementary"
    aria-label="사용 가이드"
  >
    <!-- header -->
    <div class="flex items-center justify-between px-4 h-11 border-b border-zinc-100 dark:border-zinc-800">
      <span class="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m16 8-2 6-6 2 2-6 6-2Z" /></svg>
        사용 가이드
        <span class="text-zinc-400 dark:text-zinc-500 font-normal">{{ stepIndex + 1 }} / {{ TOUR_STEPS.length }}</span>
      </span>
      <button
        type="button"
        class="w-7 h-7 -mr-1 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
        aria-label="가이드 닫기"
        @click="dismiss"
      >
        <XMarkIcon class="w-4 h-4" />
      </button>
    </div>

    <!-- body -->
    <div class="p-4">
      <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug mb-1.5">{{ current.title }}</h2>
      <p class="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{{ current.body }}</p>

      <!-- progress -->
      <div class="flex items-center gap-1.5 mt-4" aria-hidden="true">
        <span
          v-for="(s, i) in TOUR_STEPS"
          :key="s.key"
          class="h-1 rounded-full transition-colors"
          :class="i === stepIndex ? 'w-5 bg-emerald-500' : i < stepIndex ? 'w-2.5 bg-emerald-300 dark:bg-emerald-800' : 'w-2.5 bg-zinc-200 dark:bg-zinc-700'"
        />
      </div>

      <!-- actions -->
      <div v-if="isLast" class="flex flex-col gap-2 mt-4">
        <button
          type="button"
          class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 transition-colors"
          @click="convert"
        >
          {{ current.cta }}
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
        </button>
        <button
          type="button"
          class="rounded-xl px-4 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          @click="dismiss"
        >
          계속 둘러보기
        </button>
      </div>
      <div v-else class="flex items-center gap-2 mt-4">
        <button
          v-if="stepIndex > 0"
          type="button"
          class="rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          @click="prev"
        >
          이전
        </button>
        <button
          type="button"
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 transition-colors"
          @click="next"
        >
          {{ current.cta }}
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
        </button>
      </div>
    </div>
  </aside>
</template>
