<script setup lang="ts">
import { ref } from 'vue'
import type { Step } from '@/types/error'
import MarkdownBody from '@/components/common/MarkdownBody.vue'
import StepForm, { type StepFormValues } from './StepForm.vue'

const props = defineProps<{
  step: Step
  isLast: boolean
  selectionMode?: boolean
  selected?: boolean
  dimmed?: boolean
  /** core-api allows only the step's author to edit or delete it */
  canModify?: boolean
}>()
const emit = defineEmits<{
  toggle: [id: number]
  update: [id: number, values: StepFormValues]
  delete: [id: number]
}>()

const editing = ref(false)
const confirmingDelete = ref(false)

function onSubmit(values: StepFormValues) {
  emit('update', props.step.id, values)
  editing.value = false
}

const attemptTypeLabels: Record<string, string> = {
  CODE_CHANGE: 'Code Change',
  CONFIG: 'Config',
  DEPENDENCY: 'Dependency',
  ENV: 'Environment',
  ROLLBACK: 'Rollback',
  INVESTIGATION: 'Investigation',
  OTHER: 'Other',
}

function ledClass(status: string) {
  if (status === 'FAILED') return 'led-fail'
  if (status === 'IN_PROGRESS') return 'led-ref'
  return 'led-success'
}
</script>

<template>
  <div class="step-item flex gap-4 relative pb-10 transition-opacity duration-300" :data-step-id="step.id" :class="{ 'is-checked': selected, 'opacity-25': dimmed }">
    <div class="cb-wrapper">
      <input
        v-if="selectionMode"
        type="checkbox"
        :checked="selected"
        class="custom-checkbox"
        @change="$emit('toggle', step.id)"
      />
    </div>
    <div class="flex flex-col items-center">
      <div class="tl-node" :class="ledClass(step.status)" />
      <div v-if="!isLast" class="tl-line" />
    </div>
    <div class="flex-1 min-w-0 pt-0.5">
      <StepForm
        v-if="editing"
        :initial="step"
        @submit="onSubmit"
        @cancel="editing = false"
      />

      <template v-else>
        <div class="flex items-center gap-2 mb-1">
          <!-- data-tour-chip: 사용 가이드가 이 스텝을 강조할 때 칩을 붙이는 자리 -->
          <p class="text-sm text-zinc-800 dark:text-zinc-200" data-tour-chip>{{ step.title }}</p>
          <span v-if="step.attemptType" class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-[11px] text-zinc-500 dark:text-zinc-400">{{ attemptTypeLabels[step.attemptType] || step.attemptType }}</span>
        </div>
        <MarkdownBody v-if="step.body" :content="step.body" class="mt-1 mb-2" />
        <!-- 스텝 본문 아래 부가 블록(예: 사용 가이드의 조사 근거) -->
        <slot name="extra" />
        <div v-if="step.insight" class="mt-1.5 mb-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30">
          <p class="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span class="font-medium">Insight:</span> {{ step.insight }}
          </p>
        </div>
        <div class="flex items-center gap-2 mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          <span>{{ { RESOLVED: 'Resolved', IN_PROGRESS: 'In Progress', FAILED: 'Failed' }[step.status] || step.status }}</span>
          <span>&middot;</span>
          <span>{{ new Date(step.createdAt).toLocaleString() }}</span>

          <!-- author-only, and hidden while picking steps for a solution -->
          <template v-if="canModify && !selectionMode">
            <span class="flex-1" />
            <template v-if="!confirmingDelete">
              <button class="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" @click="editing = true">Edit</button>
              <button class="hover:text-rose-500 transition-colors" @click="confirmingDelete = true">Delete</button>
            </template>
            <template v-else>
              <span class="text-zinc-500 dark:text-zinc-400">Delete this step?</span>
              <button class="text-rose-500 hover:text-rose-600 font-medium transition-colors" @click="emit('delete', step.id)">Yes</button>
              <button class="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" @click="confirmingDelete = false">No</button>
            </template>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>
