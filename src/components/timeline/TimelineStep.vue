<script setup lang="ts">
import type { Step } from '@/types/error'

defineProps<{ step: Step; isLast: boolean; selectionMode?: boolean; selected?: boolean; dimmed?: boolean }>()
defineEmits<{ toggle: [id: string] }>()

function ledClass(status: string) {
  if (status === 'FAILED') return 'led-fail'
  if (status === 'IN_PROGRESS') return 'led-ref'
  return 'led-success'
}
</script>

<template>
  <div class="step-item flex gap-4 relative pb-6 transition-opacity duration-300" :class="{ 'is-checked': selected, 'opacity-25': dimmed }">
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
      <p class="text-sm text-zinc-800 dark:text-zinc-200 mb-1">{{ step.content }}</p>
      <p v-if="step.failureReason" class="text-xs text-zinc-400 dark:text-zinc-500 italic">
        {{ step.failureReason }}
      </p>
      <div class="flex items-center gap-2 mt-2 text-xs text-zinc-400 dark:text-zinc-500">
        <span class="capitalize">{{ step.status.toLowerCase().replace('_', ' ') }}</span>
        <span>&middot;</span>
        <span>{{ new Date(step.createdAt).toLocaleString() }}</span>
      </div>
    </div>
  </div>
</template>
