<script setup lang="ts">
// 리스트 끝 표시(더 불러올 게 없을 때) — 전 리스트 공통. 구분선 + 초록 점 + "All N shown".
defineProps<{ count: number }>()
</script>

<template>
  <div class="flex items-center justify-center gap-[7px] border-t border-zinc-200 dark:border-zinc-800 mt-[18px] pt-4 text-[11px] text-zinc-400 dark:text-zinc-500">
    <span class="w-1 h-1 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden="true" />
    All&nbsp;<b class="font-mono font-medium text-zinc-700 dark:text-zinc-300">{{ count }}</b>&nbsp;shown
  </div>
</template>
