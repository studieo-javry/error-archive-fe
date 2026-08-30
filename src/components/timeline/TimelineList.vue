<script setup lang="ts">
import type { Step, Solution } from '@/types/error'
import TimelineStep from './TimelineStep.vue'
import TimelineSolution from './TimelineSolution.vue'
import type { StepFormValues } from './StepForm.vue'

defineProps<{
  steps: Step[]
  solutions?: Solution[]
  selectionMode?: boolean
  selectedIds?: Set<number>
  highlightedIds?: Set<number> | null
  /** viewer id — a step is editable only by its own author */
  viewerUserId?: number | null
}>()
defineEmits<{ toggle: [id: number]; update: [id: number, values: StepFormValues]; delete: [id: number] }>()
</script>

<template>
  <div :class="{ 'selection-mode': selectionMode }">
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
    />
    <TimelineSolution
      v-for="sol in solutions"
      :key="sol.id"
      :solution="sol"
    />
  </div>
</template>
