<script setup lang="ts">
import type { Step, Solution } from '@/types/error'
import TimelineStep from './TimelineStep.vue'
import TimelineSolution from './TimelineSolution.vue'
import type { StepFormValues } from './StepForm.vue'

/** Step 이 아닌 줄(GitHub 이력 등)은 슬롯 `#entry` 로 그린다. */
export interface TimelineEntry { type: string; step?: Step }

defineProps<{
  steps: Step[]
  solutions?: Solution[]
  selectionMode?: boolean
  selectedIds?: Set<number>
  highlightedIds?: Set<number> | null
  /** viewer id — a step is editable only by its own author */
  viewerUserId?: number | null
  /** 주면 steps 대신 이 순서로 그린다(Step 과 GitHub 이력을 시간순으로 섞은 목록). */
  entries?: TimelineEntry[]
}>()
defineEmits<{ toggle: [id: number]; update: [id: number, values: StepFormValues]; delete: [id: number] }>()
</script>

<template>
  <div :class="{ 'selection-mode': selectionMode }">
    <template v-if="entries">
      <template v-for="(entry, index) in entries" :key="entry.step ? `step-${entry.step.id}` : `${entry.type}-${index}`">
        <TimelineStep
          v-if="entry.step"
          :step="entry.step"
          :is-last="index === entries.length - 1 && (!solutions || solutions.length === 0)"
          :selection-mode="selectionMode"
          :selected="selectedIds?.has(entry.step.id)"
          :dimmed="highlightedIds != null && !highlightedIds.has(entry.step.id)"
          :can-modify="viewerUserId != null && entry.step.authorUserId === viewerUserId"
          @toggle="$emit('toggle', $event)"
          @update="(id, values) => $emit('update', id, values)"
          @delete="$emit('delete', $event)"
        >
          <template #extra><slot name="step-extra" :step="entry.step" /></template>
          <template #evidence><slot name="step-evidence" :step="entry.step" /></template>
        </TimelineStep>
        <slot v-else name="entry" :entry="entry" :last="index === entries.length - 1 && (!solutions || solutions.length === 0)" />
      </template>
      <slot v-if="!entries.length" name="empty" />
    </template>
    <template v-else>
      <TimelineStep
        v-for="(step, index) in steps"
        :key="step.id"
        :step="step"
        :is-last="index === steps.length - 1 && (!solutions || solutions.length === 0)"
        :selection-mode="selectionMode"
        :selected="selectedIds?.has(step.id)"
        :dimmed="highlightedIds != null && !highlightedIds.has(step.id)"
        :can-modify="viewerUserId != null && step.authorUserId === viewerUserId"
        @toggle="$emit('toggle', $event)"
        @update="(id, values) => $emit('update', id, values)"
        @delete="$emit('delete', $event)"
      >
        <template #extra><slot name="step-extra" :step="step" /></template>
        <template #evidence><slot name="step-evidence" :step="step" /></template>
      </TimelineStep>
    </template>
    <TimelineSolution
      v-for="sol in solutions"
      :key="sol.id"
      :solution="sol"
    >
      <template #extra><slot name="solution-extra" :solution="sol" /></template>
    </TimelineSolution>
  </div>
</template>
