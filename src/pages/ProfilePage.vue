<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { authApi } from '@/services/authApi'
import { insightApi, type MyKpis, type KpiMetric } from '@/services/insightApi'
import { meApi } from '@/services/meApi'
import { useAuthStore } from '@/stores/authStore'
import type { PublicProfile, MyProfile, FollowStatusResponse } from '@/types/user'
import type { RecentActivity } from '@/types/home'
import RecentActivities from '@/components/profile/RecentActivities.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const route = useRoute()
const authStore = useAuthStore()
const profile = ref<PublicProfile | MyProfile | null>(null)
const followStatus = ref<FollowStatusResponse | null>(null)
const loading = ref(true)

const isOwnProfile = computed(() => !route.params.id || Number(route.params.id) === authStore.user?.userId)

// ── My-page dashboard (own profile only) ──
const kpis = ref<MyKpis | null>(null)
const activities = ref<RecentActivity[]>([])
const activitySummary = ref<Record<string, number>>({})

// A rate is a ratio of a count, so it rides on its owning metric as a small chip beside the label:
// resolutionRate (resolved/raised) on Resolved, publishRate (published/resolved) on Published.
const pct = (v: number | undefined) => Math.round((v ?? 0) * 100)
type Kpi = { label: string; metric: KpiMetric; rate?: number; rateTitle?: string }
const kpiCards = computed<Kpi[]>(() => {
  const k = kpis.value
  if (!k) return []
  return [
    { label: 'Errors raised', metric: k.errorsRaised },
    { label: 'Resolved', metric: k.resolved, rate: pct(k.resolutionRate), rateTitle: 'Resolution rate — resolved of errors raised' },
    { label: 'Steps added', metric: k.stepsAdded },
    { label: 'Solutions', metric: k.solutions },
    { label: 'Published', metric: k.published, rate: pct(k.publishRate), rateTitle: 'Publish rate — published of resolved' },
  ]
})

function loadDashboard() {
  // insight-api KPIs + core-api recent activities. Load independently so one failing
  // (e.g. a service down) doesn't hide the other.
  insightApi.myKpis().then(({ data }) => { kpis.value = data }).catch(() => {})
  meApi.recentActivities().then(({ data }) => {
    activities.value = data.items
    activitySummary.value = data.summary.byType
  }).catch(() => {})
}

async function loadProfile() {
  loading.value = true
  try {
    if (isOwnProfile.value) {
      const { data } = await authApi.getMe()
      profile.value = data
    } else {
      const userId = Number(route.params.id)
      const [profileRes, followRes] = await Promise.all([
        authApi.getUser(userId),
        authApi.getFollowStatus(userId),
      ])
      profile.value = profileRes.data
      followStatus.value = followRes.data
    }
  } finally {
    loading.value = false
  }
  if (isOwnProfile.value) loadDashboard()
}

const followBusy = ref(false)

async function toggleFollow() {
  if (followBusy.value || !profile.value || isOwnProfile.value || !followStatus.value) return
  followBusy.value = true
  const userId = profile.value.userId
  const wasFollowing = followStatus.value.viewerFollowsTarget
  try {
    // Both endpoints report the resulting state in `following` — mirror it as-is.
    const { data } = wasFollowing ? await authApi.unfollow(userId) : await authApi.follow(userId)
    followStatus.value.viewerFollowsTarget = data.following
    if (data.changed) followStatus.value.followersCount += data.following ? 1 : -1
  } finally {
    followBusy.value = false
  }
}

onMounted(loadProfile)
</script>

<template>
  <LoadingSpinner v-if="loading" size="lg" />

  <div v-else-if="profile" class="max-w-2xl mx-auto">
    <div class="flex items-start gap-6 mb-8">
      <img v-if="profile.avatarUrl" :src="profile.avatarUrl" :alt="profile.displayName" class="w-20 h-20 rounded-full" />
      <div class="flex-1">
        <h1 class="text-xl font-semibold text-zinc-800 dark:text-zinc-100">{{ profile.displayName }}</h1>
        <p v-if="profile.handle" class="text-sm text-zinc-500 dark:text-zinc-400">@{{ profile.handle }}</p>
        <p v-if="profile.bio" class="text-sm text-zinc-600 dark:text-zinc-300 mt-2">{{ profile.bio }}</p>
        <div v-if="followStatus" class="flex gap-4 mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          <span><strong class="text-zinc-800 dark:text-zinc-200">{{ followStatus.followersCount }}</strong> followers</span>
          <span><strong class="text-zinc-800 dark:text-zinc-200">{{ followStatus.followingCount }}</strong> following</span>
        </div>
        <button
          v-if="!isOwnProfile && followStatus"
          class="group mt-3 px-4 py-1.5 text-xs font-medium rounded-xl transition-colors disabled:opacity-60"
          :class="followStatus.viewerFollowsTarget
            ? 'bg-zinc-200 text-zinc-700 hover:bg-rose-100 hover:text-rose-700 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-400'
            : 'bg-emerald-600 text-white hover:bg-emerald-700'"
          :disabled="followBusy"
          @click="toggleFollow"
        >
          <!-- while following, hovering reveals the destructive action it will perform -->
          <template v-if="followStatus.viewerFollowsTarget">
            <span class="group-hover:hidden">Following</span>
            <span class="hidden group-hover:inline">Unfollow</span>
          </template>
          <template v-else>Follow</template>
        </button>
        <router-link
          v-else-if="isOwnProfile"
          to="/settings"
          class="inline-block mt-3 px-4 py-1.5 text-xs font-medium rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 transition-colors"
        >
          Edit Profile
        </router-link>
      </div>
    </div>

    <!-- My-page dashboard (own profile only) -->
    <template v-if="isOwnProfile">
      <section v-if="kpis" class="mt-12 pt-12 border-t border-zinc-100 dark:border-zinc-800/60">
        <h2 class="text-lg font-light serif-title text-zinc-800 dark:text-zinc-100 mb-4">Activity</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div v-for="c in kpiCards" :key="c.label" class="rounded-xl bg-zinc-50 dark:bg-zinc-800/40 p-3">
            <div class="flex items-center gap-1.5">
              <p class="text-[11px] text-zinc-500 dark:text-zinc-400">{{ c.label }}</p>
              <span
                v-if="c.rate !== undefined"
                :title="c.rateTitle"
                class="text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
              >{{ c.rate }}%</span>
            </div>
            <p class="text-2xl font-light text-zinc-800 dark:text-zinc-100 mt-1">{{ c.metric.total }}</p>
            <p
              class="text-[11px] mt-0.5"
              :class="c.metric.weeklyDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-transparent'"
            >+{{ c.metric.weeklyDelta }} this week</p>
          </div>
        </div>
      </section>

      <section v-if="activities.length" class="mt-12 pt-12 border-t border-zinc-100 dark:border-zinc-800/60">
        <RecentActivities :items="activities" :by-type="activitySummary" />
      </section>
    </template>
  </div>
</template>
