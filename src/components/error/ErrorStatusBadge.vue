<script setup lang="ts">
import type { ErrorStatus } from '@/types/error'

defineProps<{ status: ErrorStatus }>()

const statusConfig: Record<ErrorStatus, { label: string; classes: string }> = {
  OPEN: { label: 'Open', classes: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  IN_PROGRESS: { label: 'In Progress', classes: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  RESOLVED: { label: 'Resolved', classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
}
</script>

<template>
  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" :class="statusConfig[status].classes">
    {{ statusConfig[status].label }}
  </span>
</template>
