<script setup lang="ts">
// 목업 historyLoadError — 이전 이력 조회 실패. 받아 둔 이력은 그대로, 같은 쪽을 다시 시도.
import GhEvIcon from './GhEvIcon.vue'
import { useCaseGithub } from '@/composables/useCaseGithub'

const g = useCaseGithub()
</script>

<template>
  <div v-if="g.historyError.value" class="gh-ev">
    <div class="gh-pages-error" role="alert"><span><GhEvIcon name="info" size="xs" /> {{ g.historyError.value }}</span><button :disabled="g.historyBusy.value" @click="g.moreHistory()">다시 시도</button></div>
  </div>
</template>
