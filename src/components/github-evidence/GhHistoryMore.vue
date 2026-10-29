<script setup lang="ts">
// 목업 "이전 GitHub 이력 N건 더 보기" — GitHub 이력 탭은 위쪽, 모든 기록 탭은 받아 둔 이력 중 가장 오래된 줄 앞.
import GhEvIcon from './GhEvIcon.vue'
import { useCaseGithub } from '@/composables/useCaseGithub'

defineProps<{ remaining: number }>()
const g = useCaseGithub()
</script>

<template>
  <div class="gh-ev">
    <button class="history-page" @click="g.moreHistory()"><GhEvIcon name="history" size="xs" />이전 GitHub 이력 {{ Math.min(8, remaining) }}건 더 보기 <span class="tiny soft-text">({{ remaining }}건 남음)</span></button>
  </div>
</template>
