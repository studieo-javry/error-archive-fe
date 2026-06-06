<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { errorApi } from '@/services/errorApi'
import { stepApi } from '@/services/stepApi'
import { solutionApi } from '@/services/solutionApi'
import type { ErrorCaseDetail, Step, Solution, StepCreateRequest } from '@/types/error'
import ErrorStatusBadge from '@/components/error/ErrorStatusBadge.vue'
import TimelineList from '@/components/timeline/TimelineList.vue'
import StepForm from '@/components/timeline/StepForm.vue'
import SolutionSelector from '@/components/timeline/SolutionSelector.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import BodyRenderer from '@/components/common/BodyRenderer.vue'

const route = useRoute()
const errorCase = ref<ErrorCaseDetail | null>(null)
const steps = ref<Step[]>([])
const solutions = ref<Solution[]>([])
const loading = ref(true)
const selectionMode = ref(false)
const selectedStepIds = ref<Set<number>>(new Set())
const activeFilter = ref<number | null>(null)

const highlightedStepIds = computed<Set<number> | null>(() => {
  if (activeFilter.value === null) return null
  const sol = solutions.value.find(s => s.id === activeFilter.value)
  if (!sol) return null
  return new Set(sol.stepIds)
})

const activeSolution = computed(() => {
  if (activeFilter.value === null) return null
  return solutions.value.find(s => s.id === activeFilter.value) ?? null
})

const caseId = Number(route.params.id)

async function loadData() {
  loading.value = true
  try {
    const [errRes, stepsRes, solRes] = await Promise.all([
      errorApi.get(caseId),
      stepApi.list(caseId),
      solutionApi.list(caseId),
    ])
    errorCase.value = errRes.data
    steps.value = stepsRes.data
    solutions.value = solRes.data
  } finally {
    loading.value = false
  }
}

async function addStep(data: StepCreateRequest) {
  const res = await stepApi.create(caseId, data)
  steps.value.push(res.data.step)
  if (errorCase.value) {
    errorCase.value.status = res.data.caseStatus
  }
}

function toggleStepSelection(id: number) {
  if (selectedStepIds.value.has(id)) {
    selectedStepIds.value.delete(id)
  } else {
    selectedStepIds.value.add(id)
  }
  selectedStepIds.value = new Set(selectedStepIds.value)
}

async function createSolution(title: string) {
  const res = await solutionApi.create(caseId, {
    title,
    stepIds: [...selectedStepIds.value],
  })
  solutions.value.push(res.data)
  selectionMode.value = false
  selectedStepIds.value = new Set()
}

onMounted(loadData)
</script>

<template>
  <LoadingSpinner v-if="loading" size="lg" />

  <div v-else-if="errorCase" class="max-w-3xl mx-auto">
    <div class="mb-6">
      <div class="flex items-center gap-3 mb-2">
        <ErrorStatusBadge :status="errorCase.status" />
        <span class="text-xs text-zinc-400 dark:text-zinc-500">
          {{ new Date(errorCase.createdAt).toLocaleString() }}
        </span>
      </div>
      <h1 class="text-xl font-semibold text-zinc-800 dark:text-zinc-100 mb-2">
        {{ errorCase.title }}
      </h1>
      <p v-if="errorCase.scope" class="text-sm text-zinc-600 dark:text-zinc-400 mb-3">{{ errorCase.scope }}</p>
      <BodyRenderer
        v-if="errorCase.description"
        :content="errorCase.description"
        :snippets="errorCase.snippets"
        :attachments="errorCase.attachments"
        class="mb-3"
      />
      <pre v-if="errorCase.snapshot?.rawStackTrace" class="text-xs bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl overflow-x-auto text-zinc-600 dark:text-zinc-400">{{ errorCase.snapshot.rawStackTrace }}</pre>
    </div>

    <section class="mb-8">
      <div class="flex items-center justify-between mb-4 border-b border-zinc-200 dark:border-zinc-800/50 pb-4">
        <h3 class="font-bold text-zinc-800 dark:text-zinc-200">Resolution Timeline</h3>
        <SolutionSelector
          :selected-count="selectedStepIds.size"
          :active="selectionMode"
          @toggle="selectionMode = !selectionMode"
          @create="createSolution"
        />
      </div>

      <div v-if="solutions.length" class="flex items-center gap-4 mb-6">
        <button
          class="pb-1 text-xs font-medium uppercase tracking-widest transition-colors"
          :class="activeFilter === null
            ? 'text-zinc-800 dark:text-zinc-100 border-b-2 border-zinc-800 dark:border-zinc-100'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border-b-2 border-transparent'"
          @click="activeFilter = null"
        >
          All Steps
        </button>
        <button
          v-for="sol in solutions"
          :key="sol.id"
          class="pb-1 text-xs font-medium uppercase tracking-widest transition-colors flex items-center gap-1.5"
          :class="activeFilter === sol.id
            ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 border-b-2 border-transparent'"
          @click="activeFilter = sol.id"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {{ sol.title }}
        </button>
      </div>

      <TimelineList
        :steps="steps"
        :solutions="activeSolution ? [activeSolution] : []"
        :selection-mode="selectionMode"
        :selected-ids="selectedStepIds"
        :highlighted-ids="highlightedStepIds"
        @toggle="toggleStepSelection"
      />
      <StepForm @submit="addStep" />
    </section>

  </div>
</template>
