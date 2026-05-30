<script setup lang="ts">
import { onMounted } from 'vue'
import { useErrorStore } from '@/stores/errorStore'
import ErrorCard from '@/components/error/ErrorCard.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { ErrorStatus } from '@/types/error'

const store = useErrorStore()

const statusOptions: { value: ErrorStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
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
        @click="store.setFilter(opt.value as ErrorStatus | '')"
      >
        {{ opt.label }}
      </button>
    </div>

    <LoadingSpinner v-if="store.loading" size="lg" />

    <div v-else-if="store.errors.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <ErrorCard v-for="error in store.errors" :key="error.id" :error="error" />
    </div>

    <div v-else class="text-center py-12 text-zinc-400 dark:text-zinc-500">
      <p class="text-lg font-light">No errors found</p>
      <p class="text-sm mt-1">Create your first error case to get started</p>
    </div>
  </div>
</template>
