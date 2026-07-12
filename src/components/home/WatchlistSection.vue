<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { meApi } from '@/services/meApi'
import type { WatchlistFeedItem, WatchlistActivitySource } from '@/types/home'
import { timeAgo } from '@/utils/timeAgo'
import { useTeamStore } from '@/stores/teamStore'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const router = useRouter()
const teamStore = useTeamStore()

const feed = ref<WatchlistFeedItem[]>([])
const loading = ref(true)

const activityLabel: Record<WatchlistActivitySource, string> = {
  CASE_RESOLVED: 'Resolved',
  COMMENT_POSTED: 'New comment',
  STEP_ADDED: 'New step',
  SOLUTION_REGISTERED: 'New solution',
}

const activityColor: Record<WatchlistActivitySource, string> = {
  CASE_RESOLVED: 'text-emerald-600 dark:text-emerald-400',
  COMMENT_POSTED: 'text-blue-500 dark:text-blue-400',
  STEP_ADDED: 'text-amber-600 dark:text-amber-400',
  SOLUTION_REGISTERED: 'text-violet-600 dark:text-violet-400',
}

onMounted(async () => {
  try {
    const { data } = await meApi.watchlistFeed()
    feed.value = data.items
  } finally {
    loading.value = false
  }
})

function open(item: WatchlistFeedItem) {
  // detailUrl is a core-api path (/error-cases/{id}#anchor) — map caseId to the FE route, keep the hash.
  const hash = item.detailUrl.includes('#') ? item.detailUrl.slice(item.detailUrl.indexOf('#')) : ''
  router.push({ name: 'errorDetail', params: { slug: teamStore.currentSlug, id: item.id }, hash })
}

function goToSearch() {
  router.push({ name: 'search', params: { slug: 'public' } })
}
</script>

<template>
  <LoadingSpinner v-if="loading" size="md" />

  <template v-else>
    <div v-if="!feed.length" class="py-8 text-center">
      <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Watch cases to track their updates here.</p>
      <button
        class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity"
        @click="goToSearch"
      >Find cases to watch</button>
    </div>

    <div v-else class="divide-y divide-zinc-100 dark:divide-zinc-800/60">
      <button
        v-for="item in feed"
        :key="item.id"
        type="button"
        class="w-full text-left flex items-center gap-3 py-3.5 px-3 -mx-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/30 transition-colors"
        @click="open(item)"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200 line-clamp-1">{{ item.title }}</p>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            <span class="font-medium" :class="activityColor[item.latestActivitySource]">{{ activityLabel[item.latestActivitySource] }}</span>
          </p>
        </div>
        <span
          v-if="item.unreadActivityCount > 0"
          class="shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-emerald-600 text-white text-[10px] font-semibold inline-flex items-center justify-center"
          :title="`${item.unreadActivityCount} unread`"
        >{{ item.unreadActivityCount }}</span>
        <span class="text-[11px] text-zinc-400 dark:text-zinc-600 shrink-0">{{ timeAgo(item.lastActivityAt) }}</span>
      </button>
    </div>
  </template>
</template>
