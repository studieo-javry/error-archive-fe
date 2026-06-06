<script setup lang="ts">
import type { Step, Solution } from '@/types/error'
import TimelineStep from './TimelineStep.vue'
import TimelineSolution from './TimelineSolution.vue'

defineProps<{ steps: Step[]; solutions?: Solution[]; selectionMode?: boolean; selectedIds?: Set<number>; highlightedIds?: Set<number> | null }>()
defineEmits<{ toggle: [id: number] }>()
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
      @toggle="$emit('toggle', $event)"
    />
    <TimelineSolution
      v-for="sol in solutions"
      :key="sol.id"
      :solution="sol"
    />
  </div>
</template>
