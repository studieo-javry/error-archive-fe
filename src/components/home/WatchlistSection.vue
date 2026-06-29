<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { meApi } from '@/services/meApi'
import type { WatchlistFeedItem } from '@/types/home'
import { timeAgo } from '@/utils/timeAgo'
import { useTeamStore } from '@/stores/teamStore'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const router = useRouter()
const teamStore = useTeamStore()

const feed = ref<WatchlistFeedItem[]>([])
const loading = ref(true)

const activityLabel: Record<WatchlistFeedItem['activityType'], string> = {
  SOLUTION: 'New solution',
  RESOLVED: 'Resolved',
  STEP: 'New step',
  COMMENT: 'New comment',
}

const activityColor: Record<WatchlistFeedItem['activityType'], string> = {
  SOLUTION: 'text-violet-600 dark:text-violet-400',
  RESOLVED: 'text-emerald-600 dark:text-emerald-400',
  STEP: 'text-amber-600 dark:text-amber-400',
  COMMENT: 'text-blue-500 dark:text-blue-400',
}

onMounted(async () => {
  try {
    const { data } = await meApi.watchlistFeed()
    feed.value = data
  } finally {
    loading.value = false
  }
})

function goToSearch() {
  router.push({ name: 'search', params: { slug: 'public' } })
}
</script>

<template>
  <LoadingSpinner v-if="loading" size="md" />

  <template v-else>
    <div v-if="!feed.length" class="py-8 text-center">
      <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-4">관심 있는 케이스를 watchlist에 추가해 활동을 추적하세요.</p>
      <button
        class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity"
        @click="goToSearch"
      >🔍 검색에서 관심 케이스 찾기</button>
    </div>

    <div v-else class="divide-y divide-zinc-100 dark:divide-zinc-800/60">
      <router-link
        v-for="item in feed"
        :key="item.caseId"
        :to="{ name: 'errorDetail', params: { slug: teamStore.currentSlug, id: item.caseId } }"
        class="flex items-center gap-3 py-3.5 px-3 -mx-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/30 transition-colors"
      >
        <img
          v-if="item.avatarUrl"
          :src="item.avatarUrl"
          :alt="item.displayName"
          class="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 object-cover shrink-0"
        />
        <span v-else class="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-500 dark:text-zinc-300 shrink-0">
          {{ item.displayName.charAt(0).toUpperCase() }}
        </span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200 line-clamp-1">{{ item.title }}</p>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            <span class="font-medium" :class="activityColor[item.activityType]">{{ activityLabel[item.activityType] }}</span>
            · {{ item.displayName }}
          </p>
        </div>
        <span class="text-[11px] text-zinc-400 dark:text-zinc-600 shrink-0">{{ timeAgo(item.lastUpdated) }}</span>
      </router-link>
    </div>
  </template>
</template>
