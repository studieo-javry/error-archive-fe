<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { insightApi, type KpiStats } from '@/services/insightApi'
import BombGrass from '@/components/insight/BombGrass.vue'
import KpiCard from '@/components/insight/KpiCard.vue'
import Leaderboard from '@/components/insight/Leaderboard.vue'

const stats = ref<KpiStats | null>(null)

onMounted(async () => {
  const { data } = await insightApi.kpi()
  stats.value = data.data
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100 mb-6">Insights</h1>

    <div class="mb-8">
      <BombGrass />
    </div>

    <div v-if="stats" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <KpiCard :value="stats.totalErrors" label="Total Errors" />
      <KpiCard :value="stats.totalSteps" label="Total Steps" />
      <KpiCard :value="stats.totalSolutions" label="Solutions" />
      <KpiCard :value="`${stats.avgResolutionTime.toFixed(1)}`" label="Avg Resolution" suffix="d" />
    </div>

    <Leaderboard />
  </div>
</template>
