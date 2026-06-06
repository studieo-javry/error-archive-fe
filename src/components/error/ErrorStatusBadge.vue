<script setup lang="ts">
defineProps<{ status: string }>()

const statusConfig: Record<string, { label: string; classes: string }> = {
  DRAFT: { label: 'Draft', classes: 'bg-zinc-50 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400' },
  OPEN: { label: 'Open', classes: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  IN_PROGRESS: { label: 'In Progress', classes: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  RESOLVED: { label: 'Resolved', classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  CLOSED: { label: 'Closed', classes: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
}
</script>

<template>
  <span
    v-if="statusConfig[status]"
    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    :class="statusConfig[status].classes"
  >
    {{ statusConfig[status].label }}
  </span>
</template>
