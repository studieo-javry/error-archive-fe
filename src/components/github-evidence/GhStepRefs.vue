<script setup lang="ts">
// 목업 stepRefs(item) — 근거가 붙은 Step 으로 이동하는 버튼, 없으면 "Case 전체 근거".
import GhEvIcon from './GhEvIcon.vue'
import { useCaseGithub, type GhViewItem } from '@/composables/useCaseGithub'

defineProps<{ item: GhViewItem }>()
const g = useCaseGithub()
</script>

<template>
  <template v-if="item.stepIds.length">
    <button v-for="id in item.stepIds" :key="id" class="step-ref" @click="g.jumpStep(id)"><GhEvIcon name="link" size="xs" />Step {{ g.stepNo(id) ?? '—' }}</button>
  </template>
  <span v-else class="step-ref">Case 전체 근거</span>
</template>
