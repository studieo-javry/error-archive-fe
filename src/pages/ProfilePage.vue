<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { authApi } from '@/services/authApi'
import { useAuthStore } from '@/stores/authStore'
import type { PublicProfile, MyProfile, FollowStatusResponse } from '@/types/user'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const route = useRoute()
const authStore = useAuthStore()
const profile = ref<PublicProfile | MyProfile | null>(null)
const followStatus = ref<FollowStatusResponse | null>(null)
const loading = ref(true)

const isOwnProfile = computed(() => !route.params.id || Number(route.params.id) === authStore.user?.userId)

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
}

async function toggleFollow() {
  if (!profile.value || isOwnProfile.value || !followStatus.value) return
  const userId = profile.value.userId
  if (followStatus.value.viewerFollowsTarget) {
    const { data } = await authApi.unfollow(userId)
    followStatus.value.viewerFollowsTarget = !data.following
    followStatus.value.followersCount -= data.changed ? 1 : 0
  } else {
    const { data } = await authApi.follow(userId)
    followStatus.value.viewerFollowsTarget = data.following
    followStatus.value.followersCount += data.changed ? 1 : 0
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
        <p v-if="profile.bio" class="text-sm text-zinc-600 dark:text-zinc-300 mt-2">{{ profile.bio }}</p>
        <div v-if="followStatus" class="flex gap-4 mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          <span><strong class="text-zinc-800 dark:text-zinc-200">{{ followStatus.followersCount }}</strong> followers</span>
          <span><strong class="text-zinc-800 dark:text-zinc-200">{{ followStatus.followingCount }}</strong> following</span>
        </div>
        <button
          v-if="!isOwnProfile && followStatus"
          class="mt-3 px-4 py-1.5 text-xs font-medium rounded-xl transition-colors"
          :class="followStatus.viewerFollowsTarget
            ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
            : 'bg-emerald-600 text-white hover:bg-emerald-700'"
          @click="toggleFollow"
        >
          {{ followStatus.viewerFollowsTarget ? 'Following' : 'Follow' }}
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
  </div>
</template>
