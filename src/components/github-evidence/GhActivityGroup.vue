<script setup lang="ts">
// 목업 activityGroup(events, key, last) — Step 사이에 연달아 쌓인 GitHub 이력을 한 줄로 접는다.
import { computed } from 'vue'
import GhEvIcon from './GhEvIcon.vue'
import GhHistoryRow from './GhHistoryRow.vue'
import { kindName, useCaseGithub, type GhViewEvent } from '@/composables/useCaseGithub'

const props = defineProps<{ events: GhViewEvent[]; groupKey: string; last: boolean }>()
const g = useCaseGithub()
const expanded = computed(() => g.ui.activityExpandAll || g.ui.activityExpanded.has(props.groupKey))

const eventLabelShort = (e: GhViewEvent) => {
  const ref = e.masked ? `비공개 ${kindName(e)}` : `${kindName(e)} #${e.number}`
  const map: Record<string, string> = {
    PR_MERGED: `${ref} Merged`,
    PR_OPENED: `${ref} Open`,
    PR_CLOSED: `${ref} Closed`,
    PR_REOPENED: `${ref} Reopened`,
    ISSUE_CLOSED: `${ref} Closed`,
    ISSUE_REOPENED: `${ref} Reopened`,
    CI_COMPLETED: `${ref} CI ${e.conclusion === 'SUCCESS' ? '통과' : '실패'}`,
    PR_LINKED: `${ref} 연결`,
    ISSUE_LINKED: `${ref} 연결`,
    REF_REMOVED: `${ref} 참조 변경`,
    LINK_DETACHED: `${ref} 연결 해제`,
  }
  return map[e.type] || `${ref} 업데이트`
}
// Prefer a meaningful state transition over repetitive CI notifications for a useful summary.
const rank: Record<string, number> = { PR_MERGED: 8, ISSUE_CLOSED: 7, ISSUE_REOPENED: 7, PR_CLOSED: 6, PR_LINKED: 5, CI_COMPLETED: 4, PR_OPENED: 3 }
const preview = computed(() => [...props.events].sort((a, b) => (rank[b.type] || 0) - (rank[a.type] || 0) || b.at.localeCompare(a.at))[0])
const range = computed(() => {
  const from = props.events[0].when.split(' ')[0]
  const to = props.events[props.events.length - 1].when.split(' ')[0]
  return from === to ? from : `${from} – ${to}`
})

function toggle() {
  const k = props.groupKey
  if (g.ui.activityExpanded.has(k)) g.ui.activityExpanded.delete(k)
  else g.ui.activityExpanded.add(k)
}
</script>

<template>
  <div class="gh-ev">
    <div :id="`activity-${groupKey}`" class="activity-row">
      <div class="cb-wrapper" />
      <div class="activity-spine"><span class="activity-node" /><span v-if="!last" class="activity-line" /></div>
      <div class="activity-main">
        <button class="activity-trigger" :aria-expanded="expanded" :aria-label="`GitHub 활동 ${events.length}건 ${expanded ? '접기' : '펼치기'}`" @click="toggle"><span class="activity-title"><GhEvIcon name="github" size="xs" />GitHub 활동 <span class="activity-count">{{ events.length }}건</span></span><span class="activity-toggle">{{ expanded ? '접기' : '자세히 보기' }} <GhEvIcon name="chevron" size="xs" /></span></button>
        <p class="activity-preview">{{ eventLabelShort(preview) }}{{ events.length > 1 ? ` 외 ${events.length - 1}건` : '' }}</p>
        <p class="activity-meta">{{ range }} · 자동 수집 이력</p>
        <div v-if="expanded" class="activity-children"><GhHistoryRow v-for="(e, i) in events" :key="e.id" :event="e" :last="i === events.length - 1" bare /></div>
      </div>
    </div>
  </div>
</template>
