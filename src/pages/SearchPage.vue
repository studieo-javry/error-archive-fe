<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { errorApi } from '@/services/errorApi'
import type { ErrorCaseSummary } from '@/types/error'
import ErrorCard from '@/components/error/ErrorCard.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const route = useRoute()
const results = ref<ErrorCaseSummary[]>([])
const loading = ref(false)
const query = ref((route.query.q as string) || '')

async function doSearch() {
  if (!query.value.trim()) return
  loading.value = true
  try {
    const { data } = await errorApi.search(query.value)
    results.value = data.data.items
  } finally {
    loading.value = false
  }
}

watch(() => route.query.q, (q) => {
  if (q) {
    query.value = q as string
    doSearch()
  }
})

onMounted(() => {
  if (query.value) doSearch()
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100 mb-6">Search</h1>

    <div class="mb-6">
      <input
        v-model="query"
        type="text"
        placeholder="Search errors, tags, solutions..."
        class="raw-input w-full max-w-md text-sm"
        @keyup.enter="doSearch"
      />
    </div>

    <LoadingSpinner v-if="loading" size="lg" />

    <div v-else-if="results.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <ErrorCard v-for="error in results" :key="error.id" :error="error" />
    </div>

    <p v-else-if="query" class="text-sm text-zinc-400 dark:text-zinc-500">No results found for "{{ query }}"</p>
  </div>
</template>
