<script setup lang="ts">
// 목업 renderEvidenceRow(x) — Issue 행, 가려진 근거 행(관계별 목록의 바깥쪽 줄).
import { computed } from 'vue'
import GhEvIcon from './GhEvIcon.vue'
import GhStepRefs from './GhStepRefs.vue'
import { ciLabel, kindName, shortRef, statusName, useCaseGithub, type GhViewItem } from '@/composables/useCaseGithub'

const props = defineProps<{ item: GhViewItem }>()
const g = useCaseGithub()
const x = computed(() => props.item)
const ci = computed(() => ciLabel(x.value))
const open = computed(() => g.ui.expanded.has(x.value.id))
const badgeCls = computed(() => (x.value.status === 'OPEN' ? 'green' : x.value.status === 'MERGED' ? 'merged-accent' : ''))
const openSource = () => window.open(x.value.url, '_blank', 'noopener')
</script>

<template>
  <article v-if="x.masked" class="evidence-row">
    <div class="evidence-main">
      <span class="evidence-symbol"><GhEvIcon name="lock" size="sm" /></span>
      <div class="grow">
        <div class="ev-topline"><span class="badge">{{ kindName(x) }}</span><span class="badge">{{ statusName(x.status) }}</span></div>
        <p class="evidence-title masked">비공개 저장소의 {{ x.kind === 'ISSUE' ? 'Issue' : 'Pull request' }}</p>
        <div class="ev-meta"><span>현재 열람 권한으로는 상세를 볼 수 없어요.</span><GhStepRefs :item="x" /></div>
      </div>
    </div>
  </article>
  <article v-else :id="`evidence-${x.id}`" class="evidence-row" :class="`gh-row-${x.kind === 'ISSUE' ? 'issue' : 'pr'}`">
    <div class="evidence-main">
      <span class="evidence-symbol gh-type" :class="[x.kind === 'ISSUE' ? 'is-issue' : 'is-pr', x.status.toLowerCase()]"><GhEvIcon :name="x.kind === 'ISSUE' ? 'issue' : 'pr'" size="sm" /></span>
      <div class="grow">
        <div class="ev-topline"><span class="mono">{{ x.repo }} #{{ x.number }}</span><span class="badge" :class="badgeCls">{{ statusName(x.status) }}</span><span v-if="x.privacy" class="row" style="gap:3px"><GhEvIcon name="lock" size="xs" />Private</span></div>
        <button class="evidence-title" :aria-expanded="open" :aria-controls="`evidence-detail-${x.id}`" @click="g.toggleExpand(x.id)">{{ x.title }}</button>
        <div v-if="!x.stepIds.length" class="scope-subline"><span class="scope-pill"><GhEvIcon name="link" size="xs" />Case 전체 근거</span></div>
        <div v-if="ci || x.stepIds.length" class="ev-meta"><span v-if="ci" class="ci-inline" :class="ci.cls"><GhEvIcon :name="ci.icon" size="xs" />{{ ci.label }}</span><GhStepRefs v-if="x.stepIds.length" :item="x" /></div>
      </div>
      <div class="ev-end">
        <button class="icon-btn" :aria-label="`${shortRef(x)} GitHub에서 보기`" title="GitHub에서 보기" @click="openSource"><GhEvIcon name="external" size="xs" /></button>
        <button class="icon-btn" :aria-label="`${shortRef(x)} 상세 ${open ? '접기' : '펼치기'}`" :aria-expanded="open" :aria-controls="`evidence-detail-${x.id}`" @click="g.toggleExpand(x.id)"><span :style="`display:flex;transform:rotate(${open ? 180 : 0}deg)`"><GhEvIcon name="chevron" size="xs" /></span></button>
      </div>
    </div>
    <div :id="`evidence-detail-${x.id}`" class="ev-detail" :hidden="!open">
      <p>{{ x.author }} · {{ x.linkedAt }} 연결 · {{ x.via ? `Issue #${x.via}를 닫는 PR이라 자동 연결` : '직접 연결' }}</p>
      <p v-if="x.diff">변경 파일 {{ x.diff.files }}개 <span class="diff-add">+{{ x.diff.additions }}</span> <span class="diff-del">−{{ x.diff.deletions }}</span></p>
      <p v-if="x.ci?.stale" class="ci-inline stale">이전 커밋의 검사 결과입니다. 새 커밋 검증 결과가 아닙니다.</p>
      <p v-else-if="x.ci?.status === 'FAILURE'" class="red">실패한 검사: {{ x.ci.failed.join(', ') }}</p>
      <p v-else-if="x.kind === 'PULL_REQUEST' && !x.ci">CI를 사용하지 않거나 조회하지 못했을 수 있습니다.</p>
      <footer><button class="text-action accent" @click="openSource"><GhEvIcon name="external" size="xs" />{{ x.kind === 'PULL_REQUEST' ? 'GitHub에서 PR·검사 보기' : 'GitHub에서 Issue 보기' }}</button><button v-if="g.writes.value" class="text-action danger" @click="g.confirmDetach(x.id)">관련 없음 · 연결 해제</button></footer>
    </div>
  </article>
</template>
