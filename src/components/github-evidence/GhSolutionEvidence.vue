<script setup lang="ts">
// 목업 solutionHtml 의 "04 · Solution 근거 집계" — Solution 에 포함된 Step 들의 근거(중복 없이).
import { computed } from 'vue'
import GhEvidenceChip from './GhEvidenceChip.vue'
import { useCaseGithub } from '@/composables/useCaseGithub'

const props = defineProps<{ stepIds: number[] }>()
const g = useCaseGithub()
const ev = computed(() => g.items.value.filter(x => x.stepIds.some(id => props.stepIds.includes(id))))
</script>

<template>
  <div v-if="ev.length" class="gh-ev">
    <div class="solution-evidence"><p>이 Solution에 포함된 Step의 GitHub 근거</p><div class="step-evidence"><GhEvidenceChip v-for="x in ev" :key="x.id" :item="x" /></div></div>
  </div>
</template>
