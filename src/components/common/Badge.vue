<script setup lang="ts">
defineProps<{
  label: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}>()

const variantClasses: Record<string, string> = {
  default: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  danger: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  info: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
}
</script>

<template>
  <span
    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    :class="variantClasses[variant ?? 'default']"
  >
    {{ label }}
  </span>
</template>
