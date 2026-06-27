<script setup lang="ts">
import { ref } from 'vue'
import { BellIcon } from '@heroicons/vue/24/outline'
import WorkspaceSelector from '@/components/layout/WorkspaceSelector.vue'

const unreadCount = ref(3)
</script>

<template>
  <header class="glass sticky top-0 z-10 px-6 py-3 flex items-center justify-between">
    <WorkspaceSelector class="shrink-0" />
    <button class="relative p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
      <BellIcon class="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
      <span
        v-if="unreadCount > 0"
        class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center"
      >
        {{ unreadCount }}
      </span>
    </button>
  </header>
</template>
