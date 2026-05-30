<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { errorApi } from '@/services/errorApi'
import { stepApi } from '@/services/stepApi'
import { solutionApi } from '@/services/solutionApi'
import { snippetApi } from '@/services/snippetApi'
import { attachmentApi } from '@/services/attachmentApi'
import type { ErrorCase, Step, Solution, StepStatus, Snippet, Attachment } from '@/types/error'
import ErrorStatusBadge from '@/components/error/ErrorStatusBadge.vue'
import TimelineList from '@/components/timeline/TimelineList.vue'
import StepForm from '@/components/timeline/StepForm.vue'
import SolutionSelector from '@/components/timeline/SolutionSelector.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import BodyRenderer from '@/components/common/BodyRenderer.vue'
import { HeartIcon } from '@heroicons/vue/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/vue/24/solid'

const route = useRoute()
const errorCase = ref<ErrorCase | null>(null)
const steps = ref<Step[]>([])
const solutions = ref<Solution[]>([])
const snippets = ref<Snippet[]>([])
const attachments = ref<Attachment[]>([])
const loading = ref(true)
const selectionMode = ref(false)
const selectedStepIds = ref<Set<string>>(new Set())
const activeFilter = ref<string | null>(null)

const highlightedStepIds = computed<Set<string> | null>(() => {
  if (!activeFilter.value) return null
  const sol = solutions.value.find(s => s.id === activeFilter.value)
  if (!sol) return null
  return new Set(sol.selectedStepIds)
})

const activeSolution = computed(() => {
  if (!activeFilter.value) return null
  return solutions.value.find(s => s.id === activeFilter.value) ?? null
})

const errorId = route.params.id as string

async function loadData() {
  loading.value = true
  try {
    const [errRes, stepsRes, solRes, snpRes, attRes] = await Promise.all([
      errorApi.get(errorId),
      stepApi.list(errorId),
      solutionApi.list(errorId),
      snippetApi.list(errorId),
      attachmentApi.list(errorId),
    ])
    errorCase.value = errRes.data.data
    steps.value = stepsRes.data.data
    solutions.value = solRes.data.data
    snippets.value = snpRes.data.data
    attachments.value = attRes.data.data
  } finally {
    loading.value = false
  }
}

async function addStep(data: { content: string; status: StepStatus; failureReason?: string }) {
  const res = await stepApi.create(errorId, data)
  steps.value.push(res.data.data)
}

function toggleStepSelection(id: string) {
  if (selectedStepIds.value.has(id)) {
    selectedStepIds.value.delete(id)
  } else {
    selectedStepIds.value.add(id)
  }
  selectedStepIds.value = new Set(selectedStepIds.value)
}

async function createSolution(name: string, rootCause: string) {
  const res = await solutionApi.create(errorId, {
    name,
    rootCause,
    selectedStepIds: [...selectedStepIds.value],
  })
  solutions.value.push(res.data.data)
  selectionMode.value = false
  selectedStepIds.value = new Set()
}

async function toggleReaction() {
  if (!errorCase.value) return
  const res = await errorApi.react(errorId)
  errorCase.value.hasReacted = res.data.data.hasReacted
  errorCase.value.reactionCount = res.data.data.reactionCount
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
      <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-3">{{ errorCase.errorMessage }}</p>
      <BodyRenderer
        v-if="errorCase.context"
        :content="errorCase.context"
        :snippets="snippets"
        :attachments="attachments"
        class="mb-3"
      />
      <pre v-if="errorCase.stackTrace" class="text-xs bg-zinc-100 dark:bg-zinc-800 p-3 rounded-xl overflow-x-auto text-zinc-600 dark:text-zinc-400">{{ errorCase.stackTrace }}</pre>
    </div>

    <div class="flex items-center gap-4 mb-8">
      <button
        class="flex items-center gap-1.5 text-sm transition-colors"
        :class="errorCase.hasReacted ? 'text-rose-500' : 'text-zinc-400 hover:text-rose-500'"
        @click="toggleReaction"
      >
        <component :is="errorCase.hasReacted ? HeartSolidIcon : HeartIcon" class="w-4 h-4" />
        {{ errorCase.reactionCount }}
      </button>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="tag in errorCase.tags"
          :key="tag.id"
          class="px-2 py-0.5 rounded-full text-[11px] bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
        >
          {{ tag.name }}
        </span>
      </div>
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
          {{ sol.name }}
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
