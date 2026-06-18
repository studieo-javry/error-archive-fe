<script setup lang="ts">
defineProps<{ x: number; y: number }>()
defineEmits<{ quote: [] }>()
</script>

<template>
  <div
    class="fixed z-50 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-medium shadow-lg cursor-pointer hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors select-none"
    :style="{ left: `${x}px`, top: `${y - 40}px`, transform: 'translateX(-50%)' }"
    @mousedown.prevent="$emit('quote')"
  >
    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
    Quote
  </div>
</template>
