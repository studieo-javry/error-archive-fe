<script setup lang="ts">
// 목업 stepHtml 의 "03 · Step 근거" — 그 Step 에 연결된 근거 배지 + 근거 연결/편집.
import { computed } from 'vue'
import GhEvIcon from './GhEvIcon.vue'
import GhEvidenceChip from './GhEvidenceChip.vue'
import { useCaseGithub } from '@/composables/useCaseGithub'

const props = defineProps<{ stepId: number; selectionMode?: boolean }>()
const g = useCaseGithub()
const ev = computed(() => g.items.value.filter(x => x.stepIds.includes(props.stepId)))
const canTag = computed(() => g.writes.value && g.scenario.value === 'normal' && !props.selectionMode)
</script>

<template>
  <div v-if="ev.length || canTag" class="gh-ev">
    <div class="step-evidence">
      <GhEvidenceChip v-for="x in ev" :key="x.id" :item="x" />
      <button v-if="canTag" class="text-action accent" @click="g.openTagStep(stepId)"><GhEvIcon :name="ev.length ? 'link' : 'plus'" size="xs" />{{ ev.length ? '근거 편집' : '근거 연결' }}</button>
    </div>
  </div>
</template>
