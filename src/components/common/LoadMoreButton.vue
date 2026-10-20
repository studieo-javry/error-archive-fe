<script setup lang="ts">
// 모든 리스트 공통 "Load more" — 무한스크롤 대신 버튼으로 통일(Explore/Library/Search/MyPublications).
defineProps<{ loading?: boolean }>()
defineEmits<{ (e: 'more'): void }>()
</script>

<template>
  <div class="flex justify-center mt-6">
    <button
      type="button"
      class="load-more-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] border border-zinc-200 bg-white text-zinc-700 text-xs font-medium transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-60 disabled:cursor-default dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
      :disabled="loading"
      @click="$emit('more')"
    >
      <template v-if="loading">
        <span class="lm-spin" aria-hidden="true" />
        불러오는 중…
      </template>
      <template v-else>
        Load more
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6" /></svg>
      </template>
    </button>
  </div>
</template>

<style scoped>
.lm-spin {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  opacity: .5;
  animation: lm-spin .7s linear infinite;
}
@keyframes lm-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .lm-spin { animation: none; } }
</style>
