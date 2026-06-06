<script setup lang="ts">
import type { ErrorCaseSummary } from '@/types/error'
import ErrorStatusBadge from './ErrorStatusBadge.vue'

defineProps<{ error: ErrorCaseSummary }>()
</script>

<template>
  <router-link
    :to="{ name: 'errorDetail', params: { id: error.id } }"
    class="block p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 card-hover transition-colors"
  >
    <div class="flex items-start justify-between mb-3">
      <ErrorStatusBadge :status="error.status" />
      <span class="text-xs text-zinc-400 dark:text-zinc-500">
        {{ new Date(error.createdAt).toLocaleDateString() }}
      </span>
    </div>
    <h3 class="text-sm font-medium text-zinc-800 dark:text-zinc-100 mb-2 line-clamp-2">
      {{ error.title }}
    </h3>
    <div class="flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
      <span v-if="error.exceptionClass" class="font-mono truncate max-w-[200px]">{{ error.exceptionClass }}</span>
      <span v-if="error.severity != null" class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700">
        P{{ error.severity }}
      </span>
    </div>
  </router-link>
</template>
