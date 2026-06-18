<script setup lang="ts">
import type { Step } from '@/types/error'
import MarkdownBody from '@/components/common/MarkdownBody.vue'

const props = defineProps<{ step: Step; isLast: boolean; selectionMode?: boolean; selected?: boolean; dimmed?: boolean }>()
defineEmits<{ toggle: [id: number] }>()

const attemptTypeLabels: Record<string, string> = {
  CODE_CHANGE: 'Code Change',
  CONFIG: 'Config',
  DEPENDENCY: 'Dependency',
  ENV: 'Environment',
  ROLLBACK: 'Rollback',
  INVESTIGATION: 'Investigation',
  OTHER: 'Other',
}

function ledClass(status: string) {
  if (status === 'FAILED') return 'led-fail'
  if (status === 'IN_PROGRESS') return 'led-ref'
  return 'led-success'
}
</script>

<template>
  <div class="step-item flex gap-4 relative pb-6 transition-opacity duration-300" :data-step-id="step.id" :class="{ 'is-checked': selected, 'opacity-25': dimmed }">
    <div class="cb-wrapper">
      <input
        v-if="selectionMode"
        type="checkbox"
        :checked="selected"
        class="custom-checkbox"
        @change="$emit('toggle', step.id)"
      />
    </div>
    <div class="flex flex-col items-center">
      <div class="tl-node" :class="ledClass(step.status)" />
      <div v-if="!isLast" class="tl-line" />
    </div>
    <div class="flex-1 min-w-0 pt-0.5">
      <div class="flex items-center gap-2 mb-1">
        <p class="text-sm text-zinc-800 dark:text-zinc-200">{{ step.title }}</p>
        <span v-if="step.attemptType" class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-[11px] text-zinc-500 dark:text-zinc-400">{{ attemptTypeLabels[step.attemptType] || step.attemptType }}</span>
      </div>
      <MarkdownBody v-if="step.body" :content="step.body" class="mt-1 mb-2" />
      <div v-if="step.insight" class="mt-1.5 mb-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30">
        <p class="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <span class="font-medium">Insight:</span> {{ step.insight }}
        </p>
      </div>
      <div class="flex items-center gap-2 mt-2 text-xs text-zinc-400 dark:text-zinc-500">
        <span>{{ { RESOLVED: 'Resolved', IN_PROGRESS: 'In Progress', FAILED: 'Failed' }[step.status] || step.status }}</span>
        <span>&middot;</span>
        <span>{{ new Date(step.createdAt).toLocaleString() }}</span>
      </div>
    </div>
  </div>
</template>
