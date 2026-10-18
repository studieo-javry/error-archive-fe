<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authApi } from '@/services/authApi'
import { insightApi, type MyKpis, type KpiMetric } from '@/services/insightApi'
import { meApi } from '@/services/meApi'
import { useAuthStore } from '@/stores/authStore'
import type { PublicProfile, MyProfile, FollowStatusResponse, UserSummary } from '@/types/user'
import type { RecentActivity } from '@/types/home'
import RecentActivities from '@/components/profile/RecentActivities.vue'
import PublishedList from '@/components/publish/PublishedList.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Modal from '@/components/common/Modal.vue'

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
  // 본인: insight-api KPIs + 내 활동. 타인: 공개 활동 타임라인만(KPI 는 /me 전용이라 생략).
  // 각각 독립적으로 로드해 하나가 실패해도 다른 하나는 표시.
  if (isOwnProfile.value) {
    insightApi.myKpis().then(({ data }) => { kpis.value = data }).catch(() => {})
    meApi.recentActivities().then(({ data }) => {
      activities.value = data.items
      activitySummary.value = data.summary.byType
    }).catch(() => {})
  } else {
    const userId = Number(route.params.id)
    meApi.recentActivitiesOf(userId).then(({ data }) => {
      activities.value = data.items
      activitySummary.value = data.summary.byType
    }).catch(() => {})
  }
}

async function loadProfile() {
  loading.value = true
  // 프로필 전환 시 이전 사용자 데이터가 잠깐 남지 않도록 초기화.
  kpis.value = null
  activities.value = []
  activitySummary.value = {}
  try {
    if (isOwnProfile.value) {
      const { data } = await authApi.getMe()
      profile.value = data
      // 본인 프로필에서도 팔로워/팔로잉 카운트를 보여주기 위해 follow-status 조회.
      followStatus.value = (await authApi.getFollowStatus(data.userId)).data
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
  loadDashboard()
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

// ── Followers / Following list modal ──
const router = useRouter()
const profileUserId = computed<number | null>(() =>
  isOwnProfile.value ? (authStore.user?.userId ?? null) : Number(route.params.id),
)

const FOLLOW_PAGE_SIZE = 30
const followListOpen = ref(false)
const followListMode = ref<'followers' | 'following'>('followers')
const followListItems = ref<UserSummary[]>([])
const followListLoading = ref(false)
const followListPage = ref(0)
const followListTotal = ref(0)
const followListHasMore = computed(() => followListItems.value.length < followListTotal.value)
const followListTitle = computed(() => (followListMode.value === 'followers' ? 'Followers' : 'Following'))

async function openFollowList(mode: 'followers' | 'following') {
  if (profileUserId.value == null) return
  followListMode.value = mode
  followListItems.value = []
  followListPage.value = 0
  followListTotal.value = 0
  followListOpen.value = true
  await fetchFollowList()
}

async function fetchFollowList() {
  const uid = profileUserId.value
  if (uid == null || followListLoading.value) return
  followListLoading.value = true
  try {
    const params = { page: followListPage.value, size: FOLLOW_PAGE_SIZE }
    const { data } = followListMode.value === 'followers'
      ? await authApi.getFollowers(uid, params)
      : await authApi.getFollowing(uid, params)
    followListItems.value.push(...data.items)
    followListTotal.value = data.totalElements
    followListPage.value += 1
  } finally {
    followListLoading.value = false
  }
}

function goToUser(userId: number) {
  followListOpen.value = false
  router.push({ name: 'profile', params: { id: String(userId) } })
}

// 목록 행의 follow/unfollow 토글. u.isFollowing 을 즉시 반영(옵티미스틱은 서버 결과로 확정).
const followRowBusy = ref<Set<number>>(new Set())
async function toggleFollowRow(u: UserSummary) {
  if (followRowBusy.value.has(u.userId)) return
  followRowBusy.value = new Set(followRowBusy.value).add(u.userId)
  const wasFollowing = !!u.isFollowing
  try {
    const { data } = wasFollowing ? await authApi.unfollow(u.userId) : await authApi.follow(u.userId)
    u.isFollowing = data.following
  } finally {
    const s = new Set(followRowBusy.value)
    s.delete(u.userId)
    followRowBusy.value = s
  }
}

onMounted(loadProfile)
// 모달에서 다른 사용자로 이동하면 같은 라우트라 컴포넌트가 재사용된다 → 파라미터 변화 시 재로딩.
watch(() => route.params.id, () => { loadProfile() })
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
          <button type="button" class="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" @click="openFollowList('followers')">
            <strong class="text-zinc-800 dark:text-zinc-200">{{ followStatus.followersCount }}</strong> followers
          </button>
          <button type="button" class="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" @click="openFollowList('following')">
            <strong class="text-zinc-800 dark:text-zinc-200">{{ followStatus.followingCount }}</strong> following
          </button>
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

    <!-- KPI grid — 본인 프로필만 (insight /me 전용) -->
    <section v-if="isOwnProfile && kpis" class="mt-12 pt-12 border-t border-zinc-100 dark:border-zinc-800/60">
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

    <!-- Publications — 본인 프로필만. "내가 발행한 글" 은 개인 자산이라 워크스페이스 Library 가 아니라 여기. (/me) -->
    <section v-if="isOwnProfile" class="mt-12 pt-12 border-t border-zinc-100 dark:border-zinc-800/60">
      <h2 class="text-lg font-light serif-title text-zinc-800 dark:text-zinc-100 mb-4">Publications</h2>
      <PublishedList />
    </section>

    <!-- Recent activities — 본인/타인 모두. 비어 있으면 viewer 별 빈 상태를 컴포넌트가 처리. -->
    <section class="mt-12 pt-12 border-t border-zinc-100 dark:border-zinc-800/60">
      <RecentActivities
        :items="activities"
        :by-type="activitySummary"
        :is-own="isOwnProfile"
        :owner-name="profile.displayName"
      />
    </section>
  </div>

  <!-- Followers / Following list -->
  <Modal :show="followListOpen" :title="followListTitle" @close="followListOpen = false">
    <div class="min-h-[6rem]">
      <div v-if="!followListItems.length && followListLoading" class="py-8"><LoadingSpinner /></div>
      <p v-else-if="!followListItems.length" class="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
        {{ followListMode === 'followers' ? '아직 팔로워가 없어요.' : '아직 팔로우한 사람이 없어요.' }}
      </p>
      <ul v-else class="divide-y divide-zinc-100 dark:divide-zinc-700/60 -mx-2">
        <li v-for="u in followListItems" :key="u.userId" class="flex items-center gap-2 pr-1">
          <button
            type="button"
            class="flex-1 min-w-0 flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/40 transition-colors text-left"
            @click="goToUser(u.userId)"
          >
            <img v-if="u.avatarUrl" :src="u.avatarUrl" :alt="u.displayName" class="w-9 h-9 rounded-full object-cover shrink-0" />
            <div v-else class="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0 flex items-center justify-center text-xs font-medium text-zinc-500 dark:text-zinc-300">
              {{ u.displayName.charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{{ u.displayName }}</p>
              <p v-if="u.handle" class="text-xs text-zinc-400 dark:text-zinc-500 truncate">@{{ u.handle }}</p>
            </div>
          </button>
          <!-- 본인 행이 아니면 follow/unfollow 버튼 -->
          <button
            v-if="!u.isSelf"
            type="button"
            class="group shrink-0 px-3 py-1 text-xs font-medium rounded-lg transition-colors disabled:opacity-60"
            :class="u.isFollowing
              ? 'bg-zinc-100 text-zinc-600 hover:bg-rose-100 hover:text-rose-700 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-rose-500/15 dark:hover:text-rose-400'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'"
            :disabled="followRowBusy.has(u.userId)"
            @click="toggleFollowRow(u)"
          >
            <template v-if="u.isFollowing">
              <span class="group-hover:hidden">Following</span>
              <span class="hidden group-hover:inline">Unfollow</span>
            </template>
            <template v-else>Follow</template>
          </button>
        </li>
      </ul>
      <button
        v-if="followListHasMore"
        type="button"
        class="w-full mt-2 py-2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:opacity-50"
        :disabled="followListLoading"
        @click="fetchFollowList"
      >
        {{ followListLoading ? '불러오는 중…' : '더 보기' }}
      </button>
    </div>
  </Modal>
</template>
