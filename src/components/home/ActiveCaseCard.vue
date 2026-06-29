<script setup lang="ts">
import type { ActiveCaseCard } from '@/types/home'
import { timeAgo } from '@/utils/timeAgo'
import { useTeamStore } from '@/stores/teamStore'

defineProps<{ card: ActiveCaseCard }>()

const teamStore = useTeamStore()

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
    :to="{ name: 'errorDetail', params: { slug: teamStore.currentSlug, id: card.caseId } }"
    class="block p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
  >
    <div class="flex items-start justify-between gap-3 mb-3">
      <h3 class="text-sm font-medium text-zinc-800 dark:text-zinc-200 line-clamp-2 leading-snug">{{ card.title }}</h3>
      <span
        v-if="card.unread > 0"
        class="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-600 text-white text-[10px] font-semibold"
        :title="`${card.unread} new activities since you last viewed`"
      >{{ card.unread }}</span>
    </div>

    <div class="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
      <span class="font-medium" :class="statusTextColor[card.status] || 'text-zinc-400'">{{ statusLabel[card.status] || card.status }}</span>
      <span class="w-1 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
      <span>{{ timeAgo(card.lastActivityAt) }}</span>
    </div>

    <div class="flex items-center gap-4 mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">
      <span><span class="text-zinc-600 dark:text-zinc-300 font-medium">{{ card.delta24h }}</span> / 24h</span>
      <span><span class="text-zinc-600 dark:text-zinc-300 font-medium">{{ card.delta7d }}</span> / 7d</span>
    </div>
  </router-link>
</template>
