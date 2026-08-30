<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { meApi } from '@/services/meApi'
import type { WatchlistFeedItem, WatchlistActivitySource } from '@/types/home'
import { timeAgo } from '@/utils/timeAgo'
import { useTeamStore } from '@/stores/teamStore'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { StarIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const teamStore = useTeamStore()

const feed = ref<WatchlistFeedItem[]>([])
const loading = ref(true)

// "[actor] [verb] [chip]" — the chip is the activity type, colored like the design.
const verb: Record<WatchlistActivitySource, string> = {
  SOLUTION_REGISTERED: 'added a',
  STEP_ADDED: 'added a',
  COMMENT_POSTED: 'posted a',
  CASE_RESOLVED: 'marked',
}
const chipLabel: Record<WatchlistActivitySource, string> = {
  SOLUTION_REGISTERED: 'Solution',
  STEP_ADDED: 'Step',
  COMMENT_POSTED: 'Comment',
  CASE_RESOLVED: 'Resolved',
}
function chipClass(source: WatchlistActivitySource) {
  if (source === 'STEP_ADDED') return 'text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10'
  if (source === 'COMMENT_POSTED') return 'text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/50'
  return 'text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 bg-emerald-100 dark:bg-emerald-500/10'
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
  const hash = item.detailUrl.includes('#') ? item.detailUrl.slice(item.detailUrl.indexOf('#')) : ''
  router.push({ name: 'errorDetail', params: { slug: teamStore.currentSlug, id: item.id }, hash })
}
</script>

<template>
  <LoadingSpinner v-if="loading" size="md" />

  <template v-else>
    <!-- data -->
    <div v-if="feed.length" class="flex flex-col gap-6">
      <div v-for="item in feed" :key="item.id" class="nudge-row group" @click="open(item)">
        <div class="inner-content">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 min-w-0">
              <button
                v-if="item.actor"
                type="button"
                class="font-medium text-zinc-800 dark:text-zinc-200 truncate hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                :title="`View ${item.actor.displayName}'s profile`"
                @click.stop="openProfile(item.actor.userId)"
              >{{ item.actor.displayName }}</button>
              <span v-else class="font-medium text-zinc-800 dark:text-zinc-200 truncate">Someone</span>
              <span class="font-light shrink-0">{{ verb[item.latestActivitySource] }}</span>
              <span class="shrink-0 font-mono text-[10px] font-bold tracking-widest uppercase border px-1.5 py-0.5 rounded" :class="chipClass(item.latestActivitySource)">{{ chipLabel[item.latestActivitySource] }}</span>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <span v-if="item.unreadActivityCount > 0" class="text-rose-600 dark:text-rose-400 font-mono text-[10px] font-bold bg-rose-100 dark:bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-200 dark:border-transparent">{{ item.unreadActivityCount }} new</span>
              <span class="text-[11px] font-mono text-zinc-500 dark:text-zinc-600">{{ timeAgo(item.lastActivityAt) }}</span>
            </div>
          </div>

          <div class="ml-4 pl-4 border-l-2 border-zinc-200 dark:border-zinc-800 group-hover:border-emerald-500 transition-colors py-1">
            <div class="flex items-center gap-2 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 mb-1">
              <span>{{ item.status.replace('_', ' ') }}</span>
              <span>·</span>
              <span>#{{ item.id }}</span>
            </div>
            <h3 class="text-base font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-950 dark:group-hover:text-emerald-400 transition-colors leading-snug">
              {{ item.title }}
            </h3>
          </div>
        </div>
      </div>
    </div>

    <!-- empty -->
    <div v-else class="py-12 flex flex-col items-center justify-center text-center">
      <div class="w-12 h-12 rounded-full bg-white dark:bg-zinc-900/50 flex items-center justify-center mb-4 border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        <StarIcon class="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
      </div>
      <p class="text-zinc-500 dark:text-zinc-400 font-light text-sm">No starred cases yet.</p>
      <p class="text-zinc-400 dark:text-zinc-600 font-mono text-[11px] mt-2">Click ★ on any case to track it here.</p>
    </div>
  </template>
</template>
