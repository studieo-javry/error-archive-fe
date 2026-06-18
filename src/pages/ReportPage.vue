<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { publishApi, type Report } from '@/services/publishApi'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const route = useRoute()
const report = ref<Report | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const { data } = await publishApi.getReport(route.params.shareToken as string)
    report.value = data
  } catch {
    error.value = 'Report not found or has been removed'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <LoadingSpinner v-if="loading" size="lg" />

    <div v-else-if="error" class="text-center py-12">
      <p class="text-lg text-zinc-400">{{ error }}</p>
    </div>

    <div v-else-if="report">
      <div class="mb-4 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-xs text-emerald-600 dark:text-emerald-400">
        Shared Report Snapshot · Created {{ new Date(report.createdAt).toLocaleDateString() }}
      </div>
      <div class="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40">
        <pre class="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{{ JSON.stringify(report.snapshotData, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>
