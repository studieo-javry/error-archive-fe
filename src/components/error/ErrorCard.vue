<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { ErrorCaseSummary } from '@/types/error'
import { formatAbsolute } from '@/utils/timeAgo'
import { useTeamStore } from '@/stores/teamStore'

defineProps<{ error: ErrorCaseSummary }>()

const teamStore = useTeamStore()
const router = useRouter()

// Nested inside the card link, so cancel the card navigation before going to the profile.
function openProfile(userId: number) {
  router.push({ name: 'profile', params: { id: String(userId) } })
}

const statusLabel: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
}

const statusTextColor: Record<string, string> = {
  OPEN: 'text-rose-500',
  IN_PROGRESS: 'text-blue-500',
  RESOLVED: 'text-emerald-500',
}
</script>

<template>
  <router-link
    :to="{ name: 'errorDetail', params: { slug: teamStore.currentSlug, id: error.id } }"
    :data-case-id="error.id"
    class="block py-5 hover:bg-zinc-100 dark:hover:bg-zinc-800/30 -mx-4 px-4 rounded-lg transition-colors cursor-pointer"
  >
    <div class="flex items-start gap-3">
      <div class="flex-1 min-w-0">
        <div v-if="error.project || error.tags?.length" class="text-xs font-medium tracking-wide text-emerald-600 dark:text-emerald-500 mb-1">
          {{ [error.project, ...(error.tags?.slice(0, 3) ?? [])].filter(Boolean).join(' / ') }}
        </div>
        <h3 class="text-base font-medium text-zinc-800 dark:text-zinc-200 mb-1 line-clamp-2">{{ error.title }}</h3>
        <p v-if="error.descriptionPreview" class="text-sm text-zinc-500 dark:text-zinc-400 font-light line-clamp-2 leading-relaxed">{{ error.descriptionPreview }}</p>
        <button
          v-if="error.author"
          type="button"
          class="group/author flex items-center gap-1.5 mt-2.5"
          :title="`View ${error.author.displayName}'s profile`"
          @click.stop.prevent="openProfile(error.author.userId)"
        >
          <img
            v-if="error.author.avatarUrl"
            :src="error.author.avatarUrl"
            :alt="error.author.displayName"
            class="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 object-cover"
          />
          <span v-else class="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[9px] font-semibold text-zinc-500 dark:text-zinc-300">
            {{ error.author.displayName.charAt(0).toUpperCase() }}
          </span>
          <span class="text-xs text-zinc-500 dark:text-zinc-400 group-hover/author:text-emerald-600 dark:group-hover/author:text-emerald-400 transition-colors">{{ error.author.displayName }}</span>
        </button>
      </div>
      <div class="flex flex-col items-end gap-1 shrink-0 pt-0.5">
        <span class="text-xs text-zinc-400 dark:text-zinc-600">{{ formatAbsolute(error.createdAt) }}</span>
        <span class="text-[10px] font-medium" :class="statusTextColor[error.status] || 'text-zinc-400'">{{ statusLabel[error.status] || error.status }}</span>
      </div>
    </div>
  </router-link>
</template>
