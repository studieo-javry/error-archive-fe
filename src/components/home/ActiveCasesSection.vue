<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { meApi } from '@/services/meApi'
import type { RecentActiveCase } from '@/types/home'
import { timeAgo } from '@/utils/timeAgo'
import { useTeamStore } from '@/stores/teamStore'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const router = useRouter()
const teamStore = useTeamStore()
const items = ref<RecentActiveCase[]>([])
const loading = ref(true)

const statusLabel: Record<string, string> = { OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved', CLOSE: 'Closed' }
function kickerColor(status: string) {
  if (status === 'IN_PROGRESS') return 'text-indigo-600 dark:text-indigo-400'
  if (status === 'RESOLVED') return 'text-emerald-600 dark:text-emerald-500'
  if (status === 'OPEN') return 'text-amber-600 dark:text-amber-500'
  return 'text-zinc-500'
}

// BE ships both 24h and 7d deltas; show the 24h window when the case is still fresh, else 7d.
const DAY_MS = 24 * 3600 * 1000
const isFresh = (c: RecentActiveCase) => Date.now() - new Date(c.lastActivityAt).getTime() < DAY_MS
const commentDelta = (c: RecentActiveCase) => (isFresh(c) ? c.commentDelta24h : c.commentDelta7d)
const meTooDelta = (c: RecentActiveCase) => (isFresh(c) ? c.meTooDelta24h : c.meTooDelta7d)

onMounted(async () => {
  try {
    const { data } = await meApi.recentActiveCases({ windowDays: 7, limit: 5 })
    items.value = data.items
  } finally {
    loading.value = false
  }
})

function open(c: RecentActiveCase) {
  router.push({ name: 'errorDetail', params: { slug: teamStore.currentSlug, id: c.id } })
}
</script>

<template>
  <LoadingSpinner v-if="loading" size="md" />

  <p v-else-if="!items.length" class="text-sm text-zinc-500 dark:text-zinc-400 font-light pl-2">
    No recent activity on your cases.
  </p>

  <div v-else class="flex flex-col gap-6">
    <div
      v-for="c in items"
      :key="c.id"
      class="focus-row group"
      :class="c.unreadCount === 0 ? 'opacity-80 hover:opacity-100' : ''"
      @click="open(c)"
    >
      <div class="flex items-start gap-5 inner-content">
        <div class="flex-shrink-0 pt-1 w-24">
          <span class="font-mono text-[10px] font-bold tracking-widest uppercase block mb-1" :class="kickerColor(c.status)">{{ statusLabel[c.status] || c.status }}</span>
          <span class="text-zinc-500 dark:text-zinc-600 font-mono text-xs">#{{ c.id }}</span>
        </div>

        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-medium text-zinc-800 dark:text-zinc-300 mb-2.5 leading-snug group-hover:text-zinc-950 dark:group-hover:text-emerald-400 transition-colors">
            {{ c.title }}
          </h3>
          <div class="flex items-center gap-4 text-xs font-mono flex-wrap">
            <span class="text-zinc-500">{{ c.stepCount }} steps · {{ c.solutionCount }} solution{{ c.solutionCount === 1 ? '' : 's' }}</span>
            <template v-if="commentDelta(c) || meTooDelta(c)">
              <span class="text-zinc-300 dark:text-zinc-700">|</span>
              <span v-if="commentDelta(c)" class="text-zinc-500 dark:text-zinc-400"><span class="text-emerald-600 dark:text-emerald-400 font-bold">+{{ commentDelta(c) }}</span> comments</span>
              <span v-if="meTooDelta(c)" class="text-zinc-500 dark:text-zinc-400"><span class="text-emerald-600 dark:text-emerald-400 font-bold">+{{ meTooDelta(c) }}</span> me-too</span>
            </template>
          </div>
        </div>

        <div class="flex-shrink-0 flex flex-col items-end gap-2">
          <span
            v-if="c.unreadCount > 0"
            class="text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-500/10 px-2 py-1 rounded border border-emerald-200 dark:border-transparent"
          >
            <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> {{ c.unreadCount }} unread
          </span>
          <span class="text-zinc-500 dark:text-zinc-600 font-mono text-[11px]">{{ timeAgo(c.lastActivityAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
