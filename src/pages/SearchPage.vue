<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { errorApi } from '@/services/errorApi'
import { useTeamStore } from '@/stores/teamStore'
import type { ErrorCaseSummary } from '@/types/error'
import ErrorCard from '@/components/error/ErrorCard.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import LoadMoreButton from '@/components/common/LoadMoreButton.vue'
import ListEnd from '@/components/common/ListEnd.vue'

const route = useRoute()
const router = useRouter()
const teamStore = useTeamStore()
const results = ref<ErrorCaseSummary[]>([])
const loading = ref(false)
const query = ref((route.query.q as string) || '')
const statusFilter = ref('')
const nextCursor = ref<string | null>(null)
const hasNext = ref(false)

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
]
async function doSearch(append = false) {
  loading.value = true
  try {
    const params: Record<string, unknown> = { size: 20 }
    if (teamStore.currentWorkspaceId != null) params.workspaceId = teamStore.currentWorkspaceId
    if (query.value.trim()) params.q = query.value.trim()
    if (statusFilter.value) params.status = statusFilter.value
    if (append && nextCursor.value) params.cursor = nextCursor.value
    const { data } = await errorApi.search(params as Parameters<typeof errorApi.search>[0])
    if (append) {
      results.value.push(...data.items)
    } else {
      results.value = data.items
    }
    nextCursor.value = data.nextCursor
    hasNext.value = data.hasNext
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (hasNext.value && !loading.value) doSearch(true)
}

function setStatus(val: string) {
  statusFilter.value = val
  nextCursor.value = null
  doSearch()
}

function submitSearch() {
  nextCursor.value = null
  if (query.value.trim()) {
    router.replace({ name: 'search', params: { slug: teamStore.currentSlug }, query: { q: query.value } })
  } else {
    router.replace({ name: 'search', params: { slug: teamStore.currentSlug } })
  }
  doSearch()
}

watch(() => route.query.q, (q) => {
  query.value = (q as string) || ''
  nextCursor.value = null
  doSearch()
})

onMounted(() => {
  doSearch()
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100 mb-6">Search</h1>

    <div class="mb-4">
      <input
        v-model="query"
        type="text"
        placeholder="Search errors, tags, solutions..."
        class="raw-input w-full max-w-md text-sm"
        @keyup.enter="submitSearch"
      />
    </div>
    <div class="flex gap-2 mb-6">
      <button
        v-for="opt in statusOptions"
        :key="opt.value"
        class="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
        :class="statusFilter === opt.value
          ? 'bg-emerald-600 text-white'
          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'"
        @click="setStatus(opt.value)"
      >{{ opt.label }}</button>
    </div>

    <LoadingSpinner v-if="loading && !results.length" size="lg" />

    <div v-else-if="results.length">
      <div class="divide-y divide-zinc-200 dark:divide-zinc-800">
        <ErrorCard v-for="error in results" :key="error.id" :error="error" />
      </div>
      <LoadMoreButton v-if="hasNext" :loading="loading" @more="loadMore" />
      <ListEnd v-else :count="results.length" />
    </div>

    <p v-else class="text-sm text-zinc-400 dark:text-zinc-500 py-12 text-center">
      {{ query ? `No results found for "${query}"` : 'Search across all public and accessible error cases.' }}
    </p>
  </div>
</template>
