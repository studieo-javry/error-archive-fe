<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { authApi } from '@/services/authApi'
import { useAuthStore } from '@/stores/authStore'
import type { UserProfile } from '@/types/user'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const route = useRoute()
const authStore = useAuthStore()
const profile = ref<UserProfile | null>(null)
const loading = ref(true)

const isOwnProfile = computed(() => !route.params.id || route.params.id === authStore.user?.id)

async function loadProfile() {
  loading.value = true
  try {
    if (isOwnProfile.value) {
      const { data } = await authApi.getMe()
      profile.value = data
    } else {
      const { data } = await authApi.getUser(route.params.id as string)
      profile.value = data
    }
  } finally {
    loading.value = false
  }
}

async function toggleFollow() {
  if (!profile.value || isOwnProfile.value) return
  const { data } = await authApi.toggleFollow(profile.value.id)
  profile.value.isFollowing = data.isFollowing
  profile.value.followerCount += data.isFollowing ? 1 : -1
}

onMounted(loadProfile)
</script>

<template>
  <LoadingSpinner v-if="loading" size="lg" />

  <div v-else-if="profile" class="max-w-2xl mx-auto">
    <div class="flex items-start gap-6 mb-8">
      <img :src="profile.avatarUrl" :alt="profile.displayName" class="w-20 h-20 rounded-full" />
      <div class="flex-1">
        <h1 class="text-xl font-semibold text-zinc-800 dark:text-zinc-100">{{ profile.displayName }}</h1>
        <p class="text-sm text-zinc-500 dark:text-zinc-400">@{{ profile.username }}</p>
        <p v-if="profile.bio" class="text-sm text-zinc-600 dark:text-zinc-300 mt-2">{{ profile.bio }}</p>
        <div class="flex gap-4 mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          <span><strong class="text-zinc-800 dark:text-zinc-200">{{ profile.followerCount }}</strong> followers</span>
          <span><strong class="text-zinc-800 dark:text-zinc-200">{{ profile.followingCount }}</strong> following</span>
        </div>
        <button
          v-if="!isOwnProfile"
          class="mt-3 px-4 py-1.5 text-xs font-medium rounded-xl transition-colors"
          :class="profile.isFollowing
            ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'"
          @click="toggleFollow"
        >
          {{ profile.isFollowing ? 'Following' : 'Follow' }}
        </button>
        <router-link
          v-else
          to="/settings"
          class="inline-block mt-3 px-4 py-1.5 text-xs font-medium rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 transition-colors"
        >
          Edit Profile
        </router-link>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40">
        <p class="text-3xl font-light text-zinc-800 dark:text-zinc-100">{{ profile.errorCount }}</p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Error Cases</p>
      </div>
      <div class="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40">
        <p class="text-3xl font-light text-zinc-800 dark:text-zinc-100">{{ profile.solutionCount }}</p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Solutions</p>
      </div>
    </div>
  </div>
</template>
