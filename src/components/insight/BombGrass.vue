<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { insightApi, type ActivityDay } from '@/services/insightApi'

const days = ref<ActivityDay[]>([])

const levelColors = [
  'bg-zinc-100 dark:bg-zinc-800',
  'bg-emerald-200 dark:bg-emerald-900',
  'bg-emerald-400 dark:bg-emerald-700',
  'bg-emerald-600 dark:bg-emerald-500',
  'bg-emerald-800 dark:bg-emerald-400',
]

onMounted(async () => {
  const { data } = await insightApi.activity(new Date().getFullYear())
  days.value = data
})
</script>

<template>
  <div>
    <h3 class="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Activity</h3>
    <div class="flex flex-wrap gap-[3px]">
      <div
        v-for="(day, i) in days"
        :key="i"
        class="w-3 h-3 rounded-sm"
        :class="levelColors[day.level]"
        :title="`${day.date}: ${day.count} activities`"
      />
    </div>
  </div>
</template>
