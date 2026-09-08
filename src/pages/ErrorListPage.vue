<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useErrorStore } from '@/stores/errorStore'
import { useTeamStore } from '@/stores/teamStore'
import ErrorCard from '@/components/error/ErrorCard.vue'
import PublishedList from '@/components/publish/PublishedList.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { ErrorCaseStatus } from '@/types/error'

const store = useErrorStore()
const teamStore = useTeamStore()

// Library 는 두 축을 보여준다: 이 워크스페이스의 케이스, 그리고 내가 발행한 글.
// 발행물은 별 서비스(publish-api)라 목록/필터/페이징을 PublishedList 가 직접 다룬다.
const tab = ref<'cases' | 'published'>('cases')

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

const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  store.fetchErrors()
  observer = new IntersectionObserver(
    (entries) => {
      // 케이스 탭에서만 — 발행물 탭은 자기 sentinel 로 페이징한다.
      if (entries[0].isIntersecting && tab.value === 'cases') store.loadMore()
    },
    { rootMargin: '200px' },
  )
  if (sentinel.value) observer.observe(sentinel.value)
})

onUnmounted(() => {
  observer?.disconnect()
})

// 케이스 탭을 떠나면 sentinel 이 언마운트되고 돌아올 때 새로 만들어진다.
// 다시 붙이지 않으면 왕복 후 무한 스크롤이 죽는다.
watch(sentinel, (el, prev) => {
  if (prev) observer?.unobserve(prev)
  if (el) observer?.observe(el)
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

    <div class="flex items-center gap-5 text-sm border-b border-zinc-200 dark:border-zinc-800 mb-5">
      <button
        class="relative pb-2.5 transition-colors"
        :class="tab === 'cases' ? 'text-zinc-800 dark:text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'"
        @click="tab = 'cases'"
      >
        Cases
        <span v-if="tab === 'cases'" class="absolute left-0 right-0 -bottom-px h-0.5 bg-emerald-500" />
      </button>
      <button
        class="relative pb-2.5 transition-colors"
        :class="tab === 'published' ? 'text-zinc-800 dark:text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'"
        @click="tab = 'published'"
      >
        Published
        <span v-if="tab === 'published'" class="absolute left-0 right-0 -bottom-px h-0.5 bg-emerald-500" />
      </button>
    </div>

    <PublishedList v-if="tab === 'published'" />

    <template v-else>
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

        <input
          v-model="query"
          type="text"
          placeholder="Search in this library..."
          class="raw-input ml-auto w-full sm:w-56 text-sm"
        />
      </div>

      <LoadingSpinner v-if="store.loading && !store.errors.length" size="lg" />

      <template v-else>
        <div v-if="filteredErrors.length" class="divide-y divide-zinc-200 dark:divide-zinc-800">
          <ErrorCard v-for="error in filteredErrors" :key="error.id" :error="error" />
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

    <div ref="sentinel" class="h-1" />
    <LoadingSpinner v-if="store.loading && store.errors.length" size="sm" class="py-4" />
    </template>
  </div>
</template>
