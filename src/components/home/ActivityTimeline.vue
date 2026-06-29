<script setup lang="ts">
import type { RecentActivity, CaseActivitySource } from '@/types/home'
import { timeAgo } from '@/utils/timeAgo'
import { useTeamStore } from '@/stores/teamStore'
import {
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  ListBulletIcon,
  LightBulbIcon,
} from '@heroicons/vue/24/outline'

defineProps<{ items: RecentActivity[] }>()

const teamStore = useTeamStore()

const sourceMeta: Record<CaseActivitySource, { label: string; icon: typeof CheckCircleIcon; color: string }> = {
  CASE_RESOLVED: { label: 'Resolved a case', icon: CheckCircleIcon, color: 'text-emerald-500' },
  COMMENT_POSTED: { label: 'Commented', icon: ChatBubbleLeftRightIcon, color: 'text-blue-500' },
  STEP_ADDED: { label: 'Added a step', icon: ListBulletIcon, color: 'text-amber-500' },
  SOLUTION_REGISTERED: { label: 'Registered a solution', icon: LightBulbIcon, color: 'text-violet-500' },
}
</script>

<template>
  <ol class="space-y-1">
    <li v-for="a in items" :key="a.id">
      <router-link
        :to="{ name: 'errorDetail', params: { slug: teamStore.currentSlug, id: a.caseId } }"
        class="flex items-start gap-3 py-2.5 px-3 -mx-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/30 transition-colors"
      >
        <component
          :is="sourceMeta[a.type]?.icon ?? ListBulletIcon"
          class="w-4 h-4 mt-0.5 shrink-0"
          :class="sourceMeta[a.type]?.color ?? 'text-zinc-400'"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm text-zinc-700 dark:text-zinc-300">
            <span class="font-medium">{{ sourceMeta[a.type]?.label ?? a.type }}</span>
            <span class="text-zinc-500 dark:text-zinc-400"> on </span>
            <span class="text-zinc-700 dark:text-zinc-200">{{ a.caseTitle }}</span>
          </p>
          <p v-if="a.preview" class="text-xs text-zinc-500 dark:text-zinc-400 font-light line-clamp-1 mt-0.5">{{ a.preview }}</p>
        </div>
        <span class="text-[11px] text-zinc-400 dark:text-zinc-600 shrink-0 pt-0.5">{{ timeAgo(a.createdAt) }}</span>
      </router-link>
    </li>
  </ol>
</template>
