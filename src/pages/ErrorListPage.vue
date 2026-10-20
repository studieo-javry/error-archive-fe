<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useErrorStore } from '@/stores/errorStore'
import { useTeamStore } from '@/stores/teamStore'
import ErrorCard from '@/components/error/ErrorCard.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import LoadMoreButton from '@/components/common/LoadMoreButton.vue'
import type { ErrorCaseStatus } from '@/types/error'

const store = useErrorStore()
const teamStore = useTeamStore()

// Library = 이 워크스페이스의 케이스(작업 데이터). 발행물(내가 publish 한 글)은 개인 자산이라
// 워크스페이스가 아니라 Profile > Publications 로, 공개 발행물 탐색은 전역 Explore 로 분리했다.
const statusOptions: { value: ErrorCaseStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
]

// Keyword search within the current space's library (client-side filter).
const query = ref('')
const filteredErrors = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return store.errors
  return store.errors.filter(e =>
    e.title.toLowerCase().includes(q) ||
    (e.project?.toLowerCase().includes(q) ?? false) ||
    (e.tags?.some(t => t.toLowerCase().includes(q)) ?? false),
  )
})

onMounted(() => {
  store.fetchErrors()
})

// Re-fetch (and clear the keyword) when the active workspace changes.
watch(() => teamStore.currentWorkspaceId, () => {
  query.value = ''
  store.fetchErrors()
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100">
        {{ teamStore.currentWorkspace?.name ?? 'Library' }}
      </h1>
      <router-link
        :to="{ name: 'errorCreate', params: { slug: teamStore.currentSlug } }"
        class="px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
      >
        + New Error
      </router-link>
    </div>

    <p class="text-[11px] text-zinc-400 dark:text-zinc-600 mb-4">Every error case in this workspace.</p>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-3 mb-6">
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
      <input
        v-model="query"
        type="text"
        placeholder="Search in this library..."
        class="raw-input ml-auto w-full sm:w-56 text-sm"
      />
    </div>

    <LoadingSpinner v-if="store.loading && !store.errors.length" size="lg" />

    <template v-else>
      <div v-if="filteredErrors.length">
        <div class="divide-y divide-zinc-200 dark:divide-zinc-800">
          <ErrorCard v-for="error in filteredErrors" :key="error.id" :error="error" />
        </div>
        <LoadMoreButton v-if="store.hasNext" :loading="store.loading" @more="store.loadMore" />
      </div>

      <p v-else-if="store.errors.length" class="text-sm text-zinc-400 dark:text-zinc-500 py-16 text-center">
        No cases match "{{ query }}".
      </p>

      <div v-else class="flex flex-col items-center justify-center py-24 text-center border-t border-zinc-200 dark:border-zinc-800 mt-8">
        <h3 class="serif-title text-3xl text-zinc-800 dark:text-zinc-200 mb-6">Every Expert Was Once a Beginner</h3>
        <p class="text-zinc-500 font-light text-sm max-w-md mx-auto mb-10 leading-relaxed">
          The best developers don't avoid errors — they learn from them. Start documenting your journey, and turn every stumble into a stepping stone.
        </p>
        <router-link
          :to="{ name: 'errorCreate', params: { slug: teamStore.currentSlug } }"
          class="group text-xs font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 transition-colors flex items-center gap-3"
        >
          Start Logging
          <svg class="w-4 h-4 transition-transform group-hover:translate-x-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </router-link>
      </div>
    </template>
  </div>
</template>
