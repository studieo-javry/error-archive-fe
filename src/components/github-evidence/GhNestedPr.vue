<script setup lang="ts">
// 목업 renderNestedPr(x) — Issue 아래 자동 연결된 PR(childPrStyle 'b' · CI 우측 정렬).
import { computed } from 'vue'
import GhEvIcon from './GhEvIcon.vue'
import GhStepRefs from './GhStepRefs.vue'
import { ciLabel, shortRef, statusName, useCaseGithub, type GhViewItem } from '@/composables/useCaseGithub'

const props = defineProps<{ item: GhViewItem }>()
const g = useCaseGithub()
const x = computed(() => props.item)
const ci = computed(() => ciLabel(x.value))
const open = computed(() => g.ui.expanded.has(x.value.id))
const compactState = computed(() => x.value.status.toLowerCase())
const badgeCls = computed(() => (x.value.status === 'MERGED' ? 'merged-accent' : x.value.status === 'OPEN' ? 'green' : ''))
const openSource = () => window.open(x.value.url, '_blank', 'noopener')
</script>

<template>
  <article :id="`evidence-${x.id}`" class="evidence-row gh-row-pr nested-pr variant-b">
    <div class="evidence-main">
      <span class="evidence-symbol gh-type is-pr" :class="compactState"><GhEvIcon name="pr" size="sm" /></span>
      <div class="grow">
        <div class="compact-meta"><span class="compact-repo" :title="`${x.repo} #${x.number}`">{{ x.repo }} #{{ x.number }}</span><span class="badge" :class="badgeCls">{{ statusName(x.status) }}</span><GhStepRefs v-if="x.stepIds.length" :item="x" /></div>
        <div class="compact-title-stack"><div class="compact-title-line"><button class="compact-title" :aria-expanded="open" :aria-controls="`evidence-detail-${x.id}`" :title="x.title" @click="g.toggleExpand(x.id)">{{ x.title }}</button><span v-if="ci" class="compact-ci" :class="ci.cls" :title="ci.label"><GhEvIcon :name="ci.icon" size="xs" />{{ ci.label }}</span></div></div>
      </div>
      <div class="ev-end">
        <button class="icon-btn" :aria-label="`${shortRef(x)} GitHub에서 보기`" title="GitHub에서 보기" @click="openSource"><GhEvIcon name="external" size="xs" /></button>
        <button class="icon-btn" :aria-label="`${shortRef(x)} 상세 ${open ? '접기' : '펼치기'}`" :aria-expanded="open" :aria-controls="`evidence-detail-${x.id}`" @click="g.toggleExpand(x.id)"><span :style="`display:flex;transform:rotate(${open ? 180 : 0}deg)`"><GhEvIcon name="chevron" size="xs" /></span></button>
      </div>
    </div>
    <div :id="`evidence-detail-${x.id}`" class="ev-detail" :hidden="!open">
      <p>{{ x.author }} · {{ x.linkedAt }} 연결 · Issue #{{ x.via }}를 닫는 PR이라 자동 연결</p>
      <p v-if="x.stepIds.length" class="compact-scope">연결 범위 · <GhStepRefs :item="x" /></p>
      <p v-if="x.diff">변경 파일 {{ x.diff.files }}개 <span class="diff-add">+{{ x.diff.additions }}</span> <span class="diff-del">−{{ x.diff.deletions }}</span></p>
      <p v-if="x.ci?.stale" class="ci-inline stale">이전 커밋의 검사 결과입니다. 새 커밋 검증 결과가 아닙니다.</p>
      <p v-else-if="x.ci?.status === 'FAILURE'" class="red">실패한 검사: {{ x.ci.failed.join(', ') }}</p>
      <p v-else-if="!x.ci">CI를 사용하지 않거나 조회하지 못했을 수 있습니다.</p>
      <footer><button class="text-action accent" @click="openSource"><GhEvIcon name="external" size="xs" />GitHub에서 PR·검사 보기</button><button v-if="g.writes.value" class="text-action danger" @click="g.confirmDetach(x.id)">관련 없음 · 연결 해제</button></footer>
    </div>
  </article>
</template>
