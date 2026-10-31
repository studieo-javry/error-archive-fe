<script setup lang="ts">
// 목업 historyMoreButton(variant, hidden) — 모든 기록 탭은 받아 둔 이력 중 가장 오래된 줄 앞의 경계(all),
// GitHub 이력 탭은 목록 위쪽(github).
import { computed } from 'vue'
import GhEvIcon from './GhEvIcon.vue'
import { useCaseGithub } from '@/composables/useCaseGithub'

const props = defineProps<{ variant: 'all' | 'github'; hidden: number }>()
const g = useCaseGithub()
const PAGE = 8
const amount = computed(() => Math.min(PAGE, Math.max(0, props.hidden)))
const busy = computed(() => g.historyBusy.value)
const visible = computed(() => Math.min(g.ui.activityPageSize, g.events.value.length))
</script>

<template>
  <div class="gh-ev">
    <div v-if="variant === 'all'" id="older-history-boundary" class="gh-history-cutoff" aria-label="아직 불러오지 않은 이전 GitHub 활동 경계"><div class="cb-wrapper" aria-hidden="true" /><div class="gh-history-cutoff-spine" aria-hidden="true"><span class="gh-history-cutoff-line" /><span class="gh-history-cutoff-dot" /></div><div class="gh-history-cutoff-body"><div class="gh-history-cutoff-heading"><span class="gh-history-cutoff-label"><GhEvIcon name="history" size="xs" />이전 GitHub 기록</span><span class="gh-history-cutoff-rule" aria-hidden="true" /><span class="gh-history-remaining">{{ hidden }}건 남음</span></div><div class="gh-history-cutoff-detail"><p class="gh-history-cutoff-description">이 지점보다 오래된 GitHub 활동은 아직 표시되지 않았어요.</p><button type="button" class="gh-history-fetch" :disabled="busy" :aria-busy="busy ? 'true' : undefined" @click="g.moreHistory()"><GhEvIcon :name="busy ? 'clock' : 'arrow'" size="xs" />{{ busy ? '과거 기록을 가져오는 중…' : `과거 기록 ${amount}건 불러오기` }}</button></div></div></div>
    <div v-else id="older-history-boundary" class="gh-history-topmore"><div class="gh-history-topmore-head"><strong>GitHub 활동 기록</strong><span>{{ visible }} / {{ g.totalCount.value }}건 표시</span></div><button type="button" class="gh-history-fetch" :disabled="busy" :aria-busy="busy ? 'true' : undefined" @click="g.moreHistory()"><GhEvIcon name="history" size="xs" />{{ busy ? '이전 활동을 표시하는 중…' : `이전 활동 ${amount}건 더 보기` }}</button><p class="gh-history-help">현재 표시된 기록보다 오래된 활동을 확인해요. {{ hidden }}건 남음</p></div>
  </div>
</template>
