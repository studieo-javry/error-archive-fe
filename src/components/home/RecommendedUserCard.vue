<script setup lang="ts">
import type { RecommendedUser } from '@/types/home'

const props = defineProps<{ user: RecommendedUser }>()
const emit = defineEmits<{ follow: [userId: number] }>()

function onFollow() {
  emit('follow', props.user.userId)
}
</script>

<template>
  <div class="shrink-0 w-56 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 flex flex-col">
    <div class="flex items-center gap-3 mb-3">
      <img
        v-if="user.avatarUrl"
        :src="user.avatarUrl"
        :alt="user.displayName"
        class="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 object-cover"
      />
      <span v-else class="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-semibold text-zinc-500 dark:text-zinc-300">
        {{ user.displayName.charAt(0).toUpperCase() }}
      </span>
      <div class="min-w-0">
        <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{{ user.displayName }}</p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 truncate">@{{ user.handle }}</p>
      </div>
    </div>

    <p v-if="user.bio" class="text-xs text-zinc-500 dark:text-zinc-400 font-light line-clamp-2 leading-relaxed mb-3">{{ user.bio }}</p>

    <div v-if="user.tags?.length" class="flex flex-wrap gap-1.5 mb-4">
      <span
        v-for="tag in user.tags.slice(0, 3)"
        :key="tag"
        class="text-[10px] font-medium tracking-wide text-emerald-600 dark:text-emerald-500"
      >#{{ tag }}</span>
    </div>

    <button
      class="mt-auto w-full py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
      :class="user.following
        ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
        : 'bg-emerald-600 text-white hover:bg-emerald-700'"
      :disabled="user.following"
      @click="onFollow"
    >{{ user.following ? 'Following' : 'Follow' }}</button>
  </div>
</template>
