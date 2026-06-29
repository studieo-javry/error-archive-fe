<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { meApi } from '@/services/meApi'
import { authApi } from '@/services/authApi'
import type { RecommendedUser, FollowingFeedItem } from '@/types/home'
import { timeAgo } from '@/utils/timeAgo'
import { useTeamStore } from '@/stores/teamStore'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import RecommendedUserCard from './RecommendedUserCard.vue'

const teamStore = useTeamStore()

const recommended = ref<RecommendedUser[]>([])
const feed = ref<FollowingFeedItem[]>([])
const loading = ref(true)
const followingActive = ref(false) // true → show following feed; false → show recommendations
const busyUserId = ref<number | null>(null)

onMounted(async () => {
  try {
    const { data } = await meApi.followingFeed()
    feed.value = data
    if (data.length) {
      followingActive.value = true
    } else {
      const recRes = await meApi.recommendedUsers()
      recommended.value = recRes.data
    }
  } finally {
    loading.value = false
  }
})

async function follow(userId: number) {
  if (busyUserId.value != null) return
  busyUserId.value = userId
  try {
    await authApi.follow(userId)
    // Flip status, then drop from recommendations and surface the next (mock excludes followed).
    const target = recommended.value.find((u) => u.userId === userId)
    if (target) target.following = true
    const recRes = await meApi.recommendedUsers()
    recommended.value = recRes.data
    // Refresh the following feed so a newly-followed user's cases appear.
    const feedRes = await meApi.followingFeed()
    feed.value = feedRes.data
    if (feed.value.length) followingActive.value = true
  } finally {
    busyUserId.value = null
  }
}
</script>

<template>
  <LoadingSpinner v-if="loading" size="md" />

  <template v-else>
    <!-- Following feed -->
    <div v-if="followingActive && feed.length" class="divide-y divide-zinc-100 dark:divide-zinc-800/60">
      <router-link
        v-for="item in feed"
        :key="item.caseId"
        :to="{ name: 'errorDetail', params: { slug: teamStore.currentSlug, id: item.caseId } }"
        class="flex items-center gap-3 py-3.5 px-3 -mx-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/30 transition-colors"
      >
        <img
          v-if="item.author.avatarUrl"
          :src="item.author.avatarUrl"
          :alt="item.author.displayName"
          class="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 object-cover shrink-0"
        />
        <span v-else class="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-500 dark:text-zinc-300 shrink-0">
          {{ item.author.displayName.charAt(0).toUpperCase() }}
        </span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200 line-clamp-1">{{ item.title }}</p>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">{{ item.author.displayName }} · @{{ item.author.handle }}</p>
        </div>
        <span class="text-[11px] text-zinc-400 dark:text-zinc-600 shrink-0">{{ timeAgo(item.createdAt) }}</span>
      </router-link>
    </div>

    <!-- Recommended users (not following anyone) -->
    <div v-else-if="recommended.length">
      <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-4">팔로우할 만한 개발자를 추천해요.</p>
      <div class="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        <RecommendedUserCard
          v-for="user in recommended"
          :key="user.userId"
          :user="user"
          @follow="follow"
        />
      </div>
    </div>

    <!-- Recommendations exhausted -->
    <p v-else class="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">추천할 사용자가 더 없어요.</p>
  </template>
</template>
