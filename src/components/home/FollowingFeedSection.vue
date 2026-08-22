<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { meApi } from '@/services/meApi'
import { authApi } from '@/services/authApi'
import type { FollowingFeedItem, FollowingFeedAuthor, AuthorSummary } from '@/types/home'
import { timeAgo } from '@/utils/timeAgo'
import { useTeamStore } from '@/stores/teamStore'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const router = useRouter()
const teamStore = useTeamStore()

const items = ref<FollowingFeedItem[]>([])
const suggested = ref<AuthorSummary[]>([])
const loading = ref(true)

const statusLabel: Record<string, string> = { OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' }
function statusColor(status: string) {
  if (status === 'IN_PROGRESS') return 'text-indigo-600 dark:text-indigo-400'
  if (status === 'RESOLVED') return 'text-emerald-600 dark:text-emerald-500'
  if (status === 'OPEN') return 'text-amber-600 dark:text-amber-500'
  return 'text-zinc-500'
}
const initial = (name: string) => name.trim().charAt(0).toUpperCase()

// Group the flat feed into per-author trees (order preserved by first appearance).
interface Group { key: number; author: FollowingFeedAuthor | null; ownerUserId: number; cases: FollowingFeedItem[] }
const groups = computed<Group[]>(() => {
  const map = new Map<number, Group>()
  for (const it of items.value) {
    const key = it.author?.userId ?? it.ownerUserId
    if (!map.has(key)) map.set(key, { key, author: it.author, ownerUserId: it.ownerUserId, cases: [] })
    map.get(key)!.cases.push(it)
  }
  return [...map.values()]
})

onMounted(async () => {
  try {
    const { data } = await meApi.followingFeed({ limit: 6 })
    items.value = data.items
    if (!data.items.length) {
      const s = await meApi.suggestedFollowees({ limit: 4 })
      suggested.value = s.data.items
      followed.value = new Set(s.data.items.filter(u => u.isFollowing).map(u => u.userId))
    }
  } finally {
    loading.value = false
  }
})

function openCase(c: FollowingFeedItem) {
  router.push({ name: 'errorDetail', params: { slug: teamStore.currentSlug, id: c.id } })
}
function openProfile(userId: number) {
  router.push({ name: 'profile', params: { id: String(userId) } })
}

// ── Follow from the suggestion row ──
// Both endpoints report the resulting state in `following`, so mirror it as-is.
const followed = ref<Set<number>>(new Set())
const followBusy = ref<Set<number>>(new Set())

async function toggleFollow(u: AuthorSummary) {
  if (followBusy.value.has(u.userId)) return
  followBusy.value = new Set(followBusy.value).add(u.userId)
  try {
    const wasFollowing = followed.value.has(u.userId)
    const { data } = wasFollowing ? await authApi.unfollow(u.userId) : await authApi.follow(u.userId)
    const next = new Set(followed.value)
    if (data.following) next.add(u.userId)
    else next.delete(u.userId)
    followed.value = next
  } finally {
    const busy = new Set(followBusy.value)
    busy.delete(u.userId)
    followBusy.value = busy
  }
}
</script>

<template>
  <LoadingSpinner v-if="loading" size="md" />

  <template v-else>
    <!-- Team network: cases from people I follow, grouped by author -->
    <div v-if="groups.length" class="flex flex-col">
      <div v-for="g in groups" :key="g.key" class="feed-tree-group group/feed">
        <!-- author header -->
        <button type="button" class="flex items-center gap-3 mb-4 z-10 relative" @click="openProfile(g.author?.userId ?? g.ownerUserId)">
          <img v-if="g.author?.avatarUrl" :src="g.author.avatarUrl" :alt="g.author.displayName" class="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700" />
          <span v-else class="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-200 text-xs font-bold border border-zinc-200 dark:border-zinc-700 shadow-sm">{{ initial(g.author?.displayName ?? '?') }}</span>
          <span class="flex flex-col text-left">
            <span class="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{{ g.author?.displayName ?? 'Unknown' }}</span>
            <span v-if="g.author" class="text-[10px] font-mono text-zinc-500">@{{ g.author.handle }}</span>
          </span>
        </button>

        <div class="feed-tree-spine bg-zinc-200 dark:bg-zinc-800 group-hover/feed:bg-[#10b981] transition-colors duration-300" />

        <div class="feed-tree-items">
          <div v-for="c in g.cases" :key="c.id" class="feed-tree-item group" @click="openCase(c)">
            <div class="flex items-baseline gap-2 mb-1.5">
              <span class="text-[10px] font-mono font-bold uppercase tracking-wider" :class="statusColor(c.status)">{{ statusLabel[c.status] || c.status }}</span>
              <span class="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">#{{ c.id }} · {{ timeAgo(c.createdAt) }}</span>
            </div>
            <h3 class="text-base font-medium text-zinc-700 dark:text-zinc-300 mb-2 leading-snug group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
              {{ c.title }}
            </h3>
            <div v-if="c.tags.length" class="flex items-center gap-2 text-[11px] font-mono text-zinc-400 dark:text-zinc-500 flex-wrap">
              <template v-for="(t, i) in c.tags" :key="t">
                <span v-if="i > 0">·</span>
                <span>#{{ t }}</span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty: suggested people to follow -->
    <div v-else>
      <p class="text-zinc-500 dark:text-zinc-400 font-light text-sm mb-6 pl-2">
        You're not following anyone yet. Build your network through suggested members.
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 pl-2">
        <div v-for="u in suggested" :key="u.userId" class="focus-row group" @click="openProfile(u.userId)">
          <div class="inner-content flex items-center gap-4">
            <img v-if="u.avatarUrl" :src="u.avatarUrl" :alt="u.displayName" class="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0" />
            <span v-else class="w-10 h-10 rounded-full bg-zinc-100 dark:bg-[#18181b] flex items-center justify-center text-zinc-600 dark:text-zinc-300 text-xs font-bold border border-zinc-200 dark:border-zinc-700 shrink-0">{{ initial(u.displayName) }}</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate mb-0.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {{ u.displayName }} <span class="text-zinc-400 dark:text-zinc-600 font-mono text-[10px] font-normal ml-1">@{{ u.handle }}</span>
              </div>
              <div class="text-[11px] text-zinc-500 font-light truncate">{{ u.bio }}</div>
            </div>

            <!-- Follow action — makes it obvious these rows are suggestions, not just links.
                 Stops propagation so it doesn't also open the profile. -->
            <button
              type="button"
              class="group/btn shrink-0 font-mono text-[11px] font-bold uppercase tracking-widest px-2 py-1 rounded transition-colors disabled:opacity-60"
              :class="followed.has(u.userId)
                ? 'text-zinc-500 bg-zinc-100 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-400 dark:bg-zinc-800 dark:hover:text-rose-400 dark:hover:bg-rose-500/10'
                : 'text-emerald-600 bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-500 dark:group-hover:text-emerald-400'"
              :disabled="followBusy.has(u.userId)"
              @click.stop="toggleFollow(u)"
            >
              <template v-if="followed.has(u.userId)">
                <span class="group-hover/btn:hidden">Following</span>
                <span class="hidden group-hover/btn:inline">Unfollow</span>
              </template>
              <template v-else>Follow</template>
            </button>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
