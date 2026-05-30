<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { insightApi, type KpiStats } from '@/services/insightApi'
import type { ErrorCaseSummary } from '@/types/error'
import ErrorCard from '@/components/error/ErrorCard.vue'
import KpiCard from '@/components/insight/KpiCard.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()
const recentErrors = ref<ErrorCaseSummary[]>([])
const stats = ref<KpiStats | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const { data } = await insightApi.dashboard()
    recentErrors.value = data.data.recentErrors as ErrorCaseSummary[]
    stats.value = data.data.stats
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100 mb-1">
      Good {{ new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening' }}<span v-if="authStore.user">, {{ authStore.user.displayName }}</span>
    </h1>
    <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-8">Here's what's happening with your errors</p>

    <LoadingSpinner v-if="loading" size="lg" />

    <template v-else>
      <div v-if="stats" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard :value="stats.totalErrors" label="Total Errors" />
        <KpiCard :value="stats.totalSteps" label="Steps Taken" />
        <KpiCard :value="stats.totalSolutions" label="Solutions" />
        <KpiCard :value="Math.round(stats.resolvedRate * 100)" label="Resolved" suffix="%" />
      </div>

      <section>
        <h2 class="text-lg font-light serif-title text-zinc-800 dark:text-zinc-100 mb-4">Recent Errors</h2>
        <div v-if="recentErrors.length" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <ErrorCard v-for="error in recentErrors" :key="error.id" :error="error" />
        </div>
        <p v-else class="text-sm text-zinc-400">No recent errors. Create your first one!</p>
      </section>
    </template>
  </div>
</template>
