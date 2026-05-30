<script setup lang="ts">
defineProps<{ value: number | string; label: string; suffix?: string }>()
</script>

<template>
  <div class="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40">
    <p class="text-3xl font-light text-zinc-800 dark:text-zinc-100">
      {{ value }}<span v-if="suffix" class="text-lg text-zinc-400">{{ suffix }}</span>
    </p>
    <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{{ label }}</p>
  </div>
</template>
