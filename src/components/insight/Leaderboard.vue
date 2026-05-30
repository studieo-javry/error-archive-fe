<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { insightApi, type LeaderboardEntry } from '@/services/insightApi'

const entries = ref<LeaderboardEntry[]>([])

onMounted(async () => {
  const { data } = await insightApi.leaderboard(5)
  entries.value = data.data
})

const rankColors = ['text-amber-500', 'text-zinc-400', 'text-amber-700']
</script>

<template>
  <div>
    <h3 class="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Top Contributors</h3>
    <div class="space-y-2">
      <div
        v-for="entry in entries"
        :key="entry.rank"
        class="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60"
      >
        <span class="text-lg font-bold w-6 text-center" :class="rankColors[entry.rank - 1] || 'text-zinc-400'">
          {{ entry.rank }}
        </span>
        <img :src="entry.user.avatarUrl" :alt="entry.user.displayName" class="w-7 h-7 rounded-full" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{{ entry.user.displayName }}</p>
          <p class="text-[10px] text-zinc-400">{{ entry.errorCount }} errors · {{ entry.solutionCount }} solutions</p>
        </div>
        <span class="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{{ entry.score }}</span>
      </div>
    </div>
  </div>
</template>
