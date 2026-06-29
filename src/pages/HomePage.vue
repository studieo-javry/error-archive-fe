<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { meApi } from '@/services/meApi'
import type { ActiveCaseCard as ActiveCaseCardDto, RecentActivity, ActivitySummary } from '@/types/home'
import ActiveCaseCard from '@/components/home/ActiveCaseCard.vue'
import ActivitySummaryPills from '@/components/home/ActivitySummaryPills.vue'
import ActivityTimeline from '@/components/home/ActivityTimeline.vue'
import WatchlistSection from '@/components/home/WatchlistSection.vue'
import FollowingSection from '@/components/home/FollowingSection.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()

// ── Recent my active cases ──
const activeCases = ref<ActiveCaseCardDto[]>([])
const activeCasesLoading = ref(true)

// ── Recent my activities ──
const activities = ref<RecentActivity[]>([])
const activitySummary = ref<ActivitySummary[]>([])
const activitiesLoading = ref(true)

onMounted(() => {
  meApi.recentActiveCases()
    .then(({ data }) => { activeCases.value = data })
    .finally(() => { activeCasesLoading.value = false })

  meApi.recentActivities()
    .then(({ data }) => { activities.value = data.items; activitySummary.value = data.summary })
    .finally(() => { activitiesLoading.value = false })
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100 mb-1">
      Good {{ new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening' }}<span v-if="authStore.user">, {{ authStore.user.displayName }}</span>
    </h1>
    <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-8">Here's what's happening with your errors</p>

    <div class="space-y-12">
      <!-- Recent my active cases -->
      <section>
        <h2 class="text-lg font-light serif-title text-zinc-800 dark:text-zinc-100 mb-4">Active cases</h2>
        <LoadingSpinner v-if="activeCasesLoading" size="md" />
        <div v-else-if="activeCases.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <ActiveCaseCard v-for="c in activeCases" :key="c.caseId" :card="c" />
        </div>
        <p v-else class="text-sm text-zinc-400">No active cases yet. Create your first one!</p>
      </section>

      <!-- Recent my activities -->
      <section>
        <h2 class="text-lg font-light serif-title text-zinc-800 dark:text-zinc-100 mb-4">Recent activity</h2>
        <LoadingSpinner v-if="activitiesLoading" size="md" />
        <template v-else-if="activities.length">
          <ActivitySummaryPills :summary="activitySummary" class="mb-5" />
          <ActivityTimeline :items="activities" />
        </template>
        <p v-else class="text-sm text-zinc-400">No recent activity.</p>
      </section>

      <!-- Following -->
      <section>
        <h2 class="text-lg font-light serif-title text-zinc-800 dark:text-zinc-100 mb-4">Following</h2>
        <FollowingSection />
      </section>

      <!-- Watchlist -->
      <section>
        <h2 class="text-lg font-light serif-title text-zinc-800 dark:text-zinc-100 mb-4">Watchlist</h2>
        <WatchlistSection />
      </section>
    </div>
  </div>
</template>
