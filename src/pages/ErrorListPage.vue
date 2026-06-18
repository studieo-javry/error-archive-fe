<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useErrorStore } from '@/stores/errorStore'
import ErrorCard from '@/components/error/ErrorCard.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { ErrorCaseStatus } from '@/types/error'

const store = useErrorStore()

const statusOptions: { value: ErrorCaseStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
]

const severityOptions = [
  { value: 0, label: 'All' },
  { value: 1, label: 'S1' },
  { value: 2, label: 'S2' },
  { value: 3, label: 'S3' },
  { value: 4, label: 'S4' },
]

const severityFilter = ref(0)

function setSeverity(val: number) {
  severityFilter.value = val
  store.setSeverity(val || undefined)
}

const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  store.fetchErrors()
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) store.loadMore()
    },
    { rootMargin: '200px' },
  )
  if (sentinel.value) observer.observe(sentinel.value)
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100">Library</h1>
      <router-link
        to="/errors/new"
        class="px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
      >
        + New Error
      </router-link>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="opt in statusOptions"
          :key="opt.value"
          class="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
          :class="store.statusFilter === opt.value
            ? 'bg-emerald-600 text-white'
            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'"
          @click="store.setFilter(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-[11px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Severity</span>
        <button
          v-for="sev in severityOptions"
          :key="sev.value"
          class="px-2 py-1 text-[11px] font-medium rounded-full transition-colors"
          :class="severityFilter === sev.value
            ? 'bg-amber-600 text-white'
            : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600'"
          @click="setSeverity(sev.value)"
        >
          {{ sev.label }}
        </button>
      </div>
    </div>

    <LoadingSpinner v-if="store.loading && !store.errors.length" size="lg" />

    <div v-else-if="store.errors.length" class="divide-y divide-zinc-200 dark:divide-zinc-800">
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

    <div ref="sentinel" class="h-1" />
    <LoadingSpinner v-if="store.loading && store.errors.length" size="sm" class="py-4" />
  </div>
</template>
