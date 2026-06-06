<script setup lang="ts">
import { onMounted } from 'vue'
import { useErrorStore } from '@/stores/errorStore'
import ErrorCard from '@/components/error/ErrorCard.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { ErrorCaseStatus } from '@/types/error'

const store = useErrorStore()

const statusOptions: { value: ErrorCaseStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
]

onMounted(() => {
  store.fetchErrors()
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100">Library</h1>
      <router-link
        to="/errors/new"
        class="px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
      >
        + New Error
      </router-link>
    </div>

    <div class="flex gap-2 mb-6">
      <button
        v-for="opt in statusOptions"
        :key="opt.value"
        class="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
        :class="store.statusFilter === opt.value
          ? 'bg-indigo-600 text-white'
          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'"
        @click="store.setFilter(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>

    <LoadingSpinner v-if="store.loading" size="lg" />

    <div v-else-if="store.errors.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <ErrorCard v-for="error in store.errors" :key="error.id" :error="error" />
    </div>

    <div v-else class="flex flex-col items-center justify-center py-24 text-center border-t border-zinc-200 dark:border-zinc-800 mt-8">
      <h3 class="serif-title text-3xl text-zinc-800 dark:text-zinc-200 mb-6">Every Expert Was Once a Beginner</h3>
      <p class="text-zinc-500 font-light text-sm max-w-md mx-auto mb-10 leading-relaxed">
        The best developers don't avoid errors — they learn from them. Start documenting your journey, and turn every stumble into a stepping stone.
      </p>
      <router-link
        to="/errors/new"
        class="group text-xs font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 transition-colors flex items-center gap-3"
      >
        Start Logging
        <svg class="w-4 h-4 transition-transform group-hover:translate-x-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
      </router-link>
    </div>
  </div>
</template>
