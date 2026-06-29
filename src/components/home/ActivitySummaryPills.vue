<script setup lang="ts">
import type { ActivitySummary, CaseActivitySource } from '@/types/home'

defineProps<{ summary: ActivitySummary[] }>()

const sourceLabel: Record<CaseActivitySource, string> = {
  CASE_RESOLVED: 'Resolved',
  COMMENT_POSTED: 'Comments',
  STEP_ADDED: 'Steps',
  SOLUTION_REGISTERED: 'Solutions',
}

const sourceColor: Record<CaseActivitySource, string> = {
  CASE_RESOLVED: 'text-emerald-600 dark:text-emerald-400',
  COMMENT_POSTED: 'text-blue-500 dark:text-blue-400',
  STEP_ADDED: 'text-amber-600 dark:text-amber-400',
  SOLUTION_REGISTERED: 'text-violet-600 dark:text-violet-400',
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <div
      v-for="s in summary"
      :key="s.source"
      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40"
    >
      <span class="text-sm font-medium" :class="sourceColor[s.source] || 'text-zinc-600 dark:text-zinc-300'">{{ s.count }}</span>
      <span class="text-xs text-zinc-500 dark:text-zinc-400">{{ sourceLabel[s.source] || s.source }}</span>
    </div>
  </div>
</template>
