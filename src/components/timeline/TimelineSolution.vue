<script setup lang="ts">
import type { Solution } from '@/types/error'

defineProps<{ solution: Solution }>()
</script>

<template>
  <div class="step-item flex gap-4 relative pb-6 is-checked">
    <div class="cb-wrapper" />
    <div class="flex flex-col items-center">
      <div class="tl-node led-success" />
    </div>
    <div class="flex-1 min-w-0 pt-0.5">
      <div class="text-[10px] text-emerald-600 dark:text-emerald-500 font-mono mb-2 uppercase tracking-widest font-bold">Solution Found</div>
      <div class="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-6 border border-emerald-200 dark:border-emerald-500/20">
        <div class="flex justify-between items-center mb-3">
          <h4 class="text-emerald-600 dark:text-emerald-400 font-medium">{{ solution.title }}</h4>
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" />
          </svg>
        </div>
        <p class="text-xs text-zinc-400">{{ solution.stepIds.length }} steps included</p>
      </div>
    </div>
  </div>
</template>
