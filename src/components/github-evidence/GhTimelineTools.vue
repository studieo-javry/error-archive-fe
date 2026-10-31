<script setup lang="ts">
// 목업 timeline() 의 "02 · GitHub 이력 필터" — 모든 기록 / Steps / GitHub 이력.
import GhEvIcon from './GhEvIcon.vue'
import { useCaseGithub, type GhFilter } from '@/composables/useCaseGithub'

defineProps<{ selection: boolean; allGroups: boolean; stepCount: number; shownCount: number }>()
const g = useCaseGithub()
const FILTERS: [GhFilter, string][] = [['all', '모든 기록'], ['steps', 'Steps'], ['github', 'GitHub 이력']]
const total = () => (g.available.value ? g.totalCount.value : 0)
</script>

<template>
  <div class="gh-ev">
    <div class="timeline-tools">
      <div class="timeline-filters" aria-label="타임라인 필터"><button v-for="[k, l] in FILTERS" :key="k" class="filter-btn" :class="{ active: g.ui.filter === k }" :aria-pressed="g.ui.filter === k" :disabled="selection" @click="g.setFilter(k)"><GhEvIcon v-if="k === 'github'" name="github" size="xs" />{{ l }}</button></div>
      <button v-if="g.ui.filter === 'all' && allGroups" class="activity-all-toggle" @click="g.ui.activityExpandAll = !g.ui.activityExpandAll; g.ui.activityExpanded.clear()">{{ g.ui.activityExpandAll ? '활동 접기' : '활동 모두 펼치기' }} <GhEvIcon name="chevron" size="xs" /></button>
      <span v-else class="tiny soft-text">{{ g.ui.filter === 'github' ? `총 ${total()}건 · 최근 ${shownCount}건 표시` : `${stepCount} steps · ${total()} GitHub events` }}</span>
    </div>
    <p v-if="g.ui.filter === 'all' && allGroups" class="timeline-quiet-note">Step은 그대로 보여주고, 자동 수집된 GitHub 활동은 묶어서 표시해요. 필요한 이력만 펼쳐 확인할 수 있어요.</p>
  </div>
</template>
