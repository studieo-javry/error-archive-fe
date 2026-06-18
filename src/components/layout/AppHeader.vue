<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { MagnifyingGlassIcon, BellIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const searchQuery = ref('')
const unreadCount = ref(3)

function onSearch() {
  router.push({ name: 'search', query: searchQuery.value.trim() ? { q: searchQuery.value } : undefined })
}
</script>

<template>
  <header class="glass sticky top-0 z-10 px-6 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3 flex-1 max-w-md">
      <MagnifyingGlassIcon class="w-4 h-4 text-zinc-400 cursor-pointer" @click="onSearch" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search errors, tags, solutions..."
        class="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
        @keyup.enter="onSearch"
      />
    </div>
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
