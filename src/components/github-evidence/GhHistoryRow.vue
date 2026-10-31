<script setup lang="ts">
// 목업 eventHtml(e, last) — 타임라인의 GitHub 이력 한 줄.
import { computed } from 'vue'
import GhEvIcon from './GhEvIcon.vue'
import { kindName, shortRef, type GhViewEvent } from '@/composables/useCaseGithub'

const props = defineProps<{ event: GhViewEvent; last: boolean; bare?: boolean }>()
const e = computed(() => props.event)
const hide = computed(() => e.value.masked)
const desc = computed(() => {
  const x = e.value
  const ref = hide.value ? `비공개 ${kindName(x)}` : shortRef(x)
  const via = x.via && !hide.value ? `Issue #${x.via}` : 'Issue'
  const map: Record<string, string> = {
    PR_OPENED: `${ref}가 열렸습니다`,
    PR_MERGED: `${ref}가 병합됐습니다`,
    PR_CLOSED: `${ref}가 닫혔습니다`,
    PR_REOPENED: `${ref}가 다시 열렸습니다`,
    ISSUE_REOPENED: `${ref}가 다시 열렸습니다`,
    REF_REMOVED: `${ref}가 더 이상 ${via}를 닫지 않습니다 · 연결은 유지`,
    ISSUE_CLOSED: `${ref}가 닫혔습니다`,
    PR_LINKED: x.via ? `${ref}를 ${via}를 닫는 PR로 자동 연결했습니다` : `${ref}를 근거로 연결했습니다`,
    ISSUE_LINKED: `${ref}를 근거로 연결했습니다`,
    LINK_DETACHED: `${ref} 연결을 해제했습니다`,
    CI_COMPLETED: `${ref} · CI ${x.conclusion === 'SUCCESS' ? '통과' : '실패'}${!hide.value && x.total ? ` ${x.passed}/${x.total}` : ''}`,
  }
  return map[x.type] || ref
})
</script>

<template>
  <div :class="{ 'gh-ev': !bare }">
    <div :id="`event-${e.id}`" class="history-row">
      <div class="cb-wrapper" />
      <div class="step-spine"><div class="history-node" /><div v-if="!last" class="history-line" /></div>
      <div class="history-content">
        <div class="history-head"><GhEvIcon :name="hide ? 'lock' : 'github'" size="xs" /><span>{{ desc }}</span><time class="history-time">{{ e.when }}</time></div>
        <div v-if="!hide" class="history-repo">{{ e.repo }}</div>
      </div>
    </div>
  </div>
</template>
