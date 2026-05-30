<script setup lang="ts">
import type { ErrorCaseSummary } from '@/types/error'
import ErrorStatusBadge from './ErrorStatusBadge.vue'
import { ChatBubbleLeftIcon, HeartIcon } from '@heroicons/vue/24/outline'

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
    <div class="flex flex-wrap gap-1.5 mb-3">
      <span
        v-for="tag in error.tags"
        :key="tag.id"
        class="px-2 py-0.5 rounded-full text-[11px] bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
      >
        {{ tag.name }}
      </span>
    </div>
    <div class="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
      <div class="flex items-center gap-3">
        <span class="flex items-center gap-1">
          <HeartIcon class="w-3.5 h-3.5" />
          {{ error.reactionCount }}
        </span>
        <span class="flex items-center gap-1">
          <ChatBubbleLeftIcon class="w-3.5 h-3.5" />
          {{ error.commentCount }}
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <img :src="error.author.avatarUrl" :alt="error.author.displayName" class="w-4 h-4 rounded-full" />
        <span>{{ error.author.displayName }}</span>
      </div>
    </div>
  </router-link>
</template>
