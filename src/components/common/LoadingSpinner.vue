<script setup lang="ts">
defineProps<{ size?: 'sm' | 'md' | 'lg' }>()

const sizeClasses = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
</script>

<template>
  <div class="flex items-center justify-center">
    <div
      class="animate-spin rounded-full border-2 border-zinc-200 border-t-indigo-600 dark:border-zinc-700 dark:border-t-indigo-400"
      :class="sizeClasses[size ?? 'md']"
    />
  </div>
</template>
