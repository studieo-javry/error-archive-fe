<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { insightApi, type ActivityGrassResponse } from '@/services/insightApi'
import InsightHeatmap from '@/components/insight/InsightHeatmap.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const grass = ref<ActivityGrassResponse | null>(null)
const loading = ref(true)
const failed = ref(false)

// Human, slightly poetic names for each raw activity type.
const ACTIVITY_LABELS: Record<string, string> = {
  CASE_CREATED: 'Logs documented',
  CASE_RESOLVED: 'Cases resolved',
  CASE_PUBLISHED: 'Knowledge synced',
  STEP_ADDED: 'Debug steps',
  SOLUTION_ADDED: 'Core solutions',
  COMMENT_POSTED: 'Discussions',
  COMMENT_REACTION: 'Reactions',
  COMMENT_HELPFUL: 'Helpful marks',
  FOLLOWED_USER: 'New connections',
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Action topology — aggregate every day's breakdown, ranked by volume.
const actionTopology = computed(() => {
  const totals: Record<string, number> = {}
  for (const d of grass.value?.days ?? []) {
    for (const [type, n] of Object.entries(d.breakdown)) totals[type] = (totals[type] ?? 0) + n
  }
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1])
  const max = sorted[0]?.[1] ?? 1
  return sorted.map(([type, n]) => ({
    label: ACTIVITY_LABELS[type] ?? type,
    count: n,
    width: Math.round((100 * n) / max),
  }))
})

// Daily rhythms — average score per weekday.
const dailyRhythms = computed(() => {
  const sums = [0, 0, 0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const d of grass.value?.days ?? []) {
    const dow = parseYMD(d.date).getDay()
    sums[dow] += d.score
    counts[dow]++
  }
  const avgs = sums.map((s, i) => (counts[i] ? s / counts[i] : 0))
  const max = Math.max(...avgs, 0.01)
  return WEEKDAYS.map((label, i) => ({
    label,
    avg: avgs[i].toFixed(1),
    width: Math.round((100 * avgs[i]) / max),
  }))
})

onMounted(async () => {
  try {
    const { data } = await insightApi.myGrass()
    grass.value = data
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <LoadingSpinner v-if="loading" size="lg" class="mt-20" />

    <p v-else-if="failed || !grass" class="text-sm text-zinc-400 dark:text-zinc-500 mt-20 text-center font-light">
      No signal yet — start resolving errors and your patterns will surface here.
    </p>

    <template v-else>
      <!-- Title & docstring -->
      <div class="mb-16 border-b border-zinc-200 dark:border-zinc-800 pb-12 pt-4 transition-colors">
        <div class="font-mono text-[11px] leading-relaxed mb-6 border-l-[3px] border-emerald-500/50 pl-4 transition-colors">
          <span class="text-zinc-400 dark:text-zinc-500">/**</span><br />
          <span class="text-zinc-400 dark:text-zinc-500"> *</span> <span class="text-emerald-600 dark:text-emerald-500">@title</span> <span class="text-zinc-500 dark:text-zinc-400">Signal &amp; Noise</span><br />
          <span class="text-zinc-400 dark:text-zinc-500"> *</span> <span class="text-emerald-600 dark:text-emerald-500">@desc</span>&nbsp; <span class="text-zinc-500 dark:text-zinc-400">Analyzes and visualizes your annual error resolution patterns.</span><br />
          <span class="text-zinc-400 dark:text-zinc-500"> */</span>
        </div>
        <h1 class="serif-title text-4xl md:text-5xl text-zinc-900 dark:text-zinc-100 tracking-tight">Signal &amp; Noise</h1>
      </div>

      <!-- Narrative timeline -->
      <div class="border-l border-zinc-200 dark:border-zinc-800 ml-4 pl-10 space-y-20 relative transition-colors">
        <!-- Macro overview -->
        <section class="relative">
          <div class="absolute w-2 h-2 bg-emerald-500 rounded-full -left-[45px] top-1.5 shadow-[0_0_10px_rgba(16,185,129,0.3)] dark:shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          <div class="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mb-2 uppercase tracking-widest">Macro overview</div>
          <p class="text-[15px] text-zinc-700 dark:text-zinc-300 leading-relaxed font-light">
            You've stayed in the work for
            <span class="font-mono text-emerald-600 dark:text-emerald-400 text-lg px-1">{{ grass.totals.activeDays }}</span>
            days this year. Through steady iteration you logged and worked through
            <span class="font-mono text-emerald-600 dark:text-emerald-400 text-lg font-bold px-1">{{ grass.totals.events }}</span>
            moments of progress, quietly raising the structural integrity of everything you touch.
          </p>
        </section>

        <!-- Momentum analysis -->
        <section class="relative">
          <div class="absolute w-2 h-2 bg-zinc-300 dark:bg-zinc-600 rounded-full -left-[45px] top-1.5 transition-colors" />
          <div class="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mb-2 uppercase tracking-widest">Momentum analysis</div>
          <p class="text-[15px] text-zinc-600 dark:text-zinc-400 leading-relaxed font-light">
            Your deepest state of flow lasted
            <span class="font-mono text-zinc-800 dark:text-zinc-200 text-lg px-1">{{ grass.streak.longest }}</span>
            consecutive days.<br />
            Right now you're riding a
            <span class="font-mono text-zinc-800 dark:text-zinc-200 text-lg px-1">{{ grass.streak.current }}</span>
            day rhythm — keep the momentum alive.
          </p>
        </section>

        <!-- Activity matrix -->
        <section class="relative">
          <div class="absolute w-2 h-2 bg-zinc-300 dark:bg-zinc-600 rounded-full -left-[45px] top-1.5 transition-colors" />
          <div class="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mb-2 uppercase tracking-widest">Activity matrix</div>
          <p class="text-[15px] text-zinc-600 dark:text-zinc-400 font-light mb-8">
            Below is your cognitive footprint. Hover an active cell to light a fuse — a kinetic feedback ring blooms with the day's density.
          </p>
          <InsightHeatmap :days="grass.days" :best-day="grass.bestDay" />
        </section>

        <!-- Structural breakdown -->
        <section class="relative">
          <div class="absolute w-2 h-2 bg-zinc-300 dark:bg-zinc-600 rounded-full -left-[45px] top-1.5 transition-colors" />
          <div class="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mb-2 uppercase tracking-widest">Structural breakdown</div>
          <p class="text-[15px] text-zinc-600 dark:text-zinc-400 font-light mb-10">
            Deconstructing the shape of your work — the kinds of actions you took, and the rhythm of your week.
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div>
              <h3 class="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-6 transition-colors">Action topology</h3>
              <div class="space-y-5">
                <div v-for="row in actionTopology" :key="row.label" class="flex items-center gap-5">
                  <div class="w-36 text-zinc-500 dark:text-zinc-400 text-[13px] font-light">{{ row.label }}</div>
                  <div class="flex-1 h-[1px] bg-zinc-200 dark:bg-zinc-800 relative transition-colors">
                    <div class="absolute top-0 left-0 h-[1px] bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] dark:shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all" :style="{ width: row.width + '%' }" />
                  </div>
                  <div class="w-8 text-right font-mono text-zinc-700 dark:text-zinc-300 text-[13px]">{{ row.count }}</div>
                </div>
                <p v-if="!actionTopology.length" class="text-[13px] text-zinc-400 dark:text-zinc-500 font-light">No actions recorded yet.</p>
              </div>
            </div>

            <div>
              <h3 class="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-6 transition-colors">Daily rhythms</h3>
              <div class="space-y-5">
                <div v-for="row in dailyRhythms" :key="row.label" class="flex items-center gap-5">
                  <div class="w-24 text-zinc-500 dark:text-zinc-400 text-[13px] font-light">{{ row.label }}</div>
                  <div class="flex-1 h-[1px] bg-zinc-200 dark:bg-zinc-800 relative transition-colors">
                    <div class="absolute top-0 left-0 h-[1px] bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] dark:shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all" :style="{ width: row.width + '%' }" />
                  </div>
                  <div class="w-8 text-right font-mono text-zinc-700 dark:text-zinc-300 text-[13px]">{{ row.avg }}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
