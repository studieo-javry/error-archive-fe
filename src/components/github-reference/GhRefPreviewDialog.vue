<script setup lang="ts">
// 목업 openGithubPreview — 본문 참조 클릭 미리보기. 참조는 인용일 뿐이라, 공식 근거 연결은 사용자가 따로 한다.
import { computed, nextTick, ref, watch } from 'vue'
import GhEvIcon from '@/components/github-evidence/GhEvIcon.vue'
import { statusName } from '@/composables/useCaseGithub'
import type { GithubRefs } from '@/composables/useGithubRefs'
import '@/styles/github-reference.css'

const props = defineProps<{ refs: GithubRefs }>()
const dialog = ref<HTMLDialogElement | null>(null)
const p = computed(() => props.refs.preview.value)
const linked = computed(() => (p.value ? props.refs.linkedItem(p.value) : null))
const statusStyle = computed(() => (p.value?.status === 'MERGED' ? 'merged-accent' : p.value?.status === 'OPEN' ? 'green' : ''))
const kindLabel = computed(() => (p.value?.kind === 'ISSUE' ? 'Issue' : p.value?.kind === 'PULL_REQUEST' ? 'Pull request' : 'GitHub 참조'))
const symbol = computed(() => (p.value?.kind === 'ISSUE' ? 'issue' : p.value?.kind === 'PULL_REQUEST' ? 'pr' : 'github'))

watch(p, async v => {
  await nextTick()
  const d = dialog.value
  if (!d) return
  if (v && !d.open) d.showModal()
  else if (!v && d.open) d.close()
})

function onBackdrop(e: MouseEvent) {
  if (e.target === dialog.value) props.refs.close()
}
</script>

<template>
  <div class="gh-ref">
    <dialog ref="dialog" class="github-preview-dialog" aria-labelledby="github-preview-heading" @click="onBackdrop" @close="refs.close()">
      <template v-if="p">
        <div class="gpm-top"><div class="gpm-eyebrow"><GhEvIcon name="github" size="sm" /><span>GitHub Preview</span></div><button class="gpm-close" type="button" aria-label="미리보기 닫기" @click="refs.close()"><GhEvIcon name="close" size="sm" /></button></div>
        <div class="gpm-content"><div class="gpm-context"><span class="gpm-repo">{{ p.repo }}</span><span class="gpm-separator">/</span><span>{{ kindLabel }} #{{ p.number }}</span></div>
          <div class="gpm-title-line"><span class="gpm-symbol" :class="p.kind === 'ISSUE' ? 'issue' : 'pr'"><GhEvIcon :name="symbol" size="sm" /></span><h3 id="github-preview-heading">{{ p.title }}</h3></div>
          <div class="gpm-meta"><span class="badge" :class="statusStyle">{{ statusName(p.status) }}</span><span v-if="linked" class="gpm-connected"><GhEvIcon name="check" size="xs" />Case 근거에 연결됨</span><span v-else class="gpm-unlinked">본문에서 인용한 GitHub 참조</span></div></div>
        <div class="gpm-footer"><div class="gpm-main-actions"><button v-if="linked" class="gpm-btn linked" type="button" @click="refs.jumpEvidence(linked.id)"><GhEvIcon name="link" size="xs" />연결된 근거 보기</button><button v-else class="gpm-btn linked" type="button" disabled title="아직 Case의 공식 근거로 연결되지 않았습니다"><GhEvIcon name="link" size="xs" />연결된 근거 보기</button><button class="gpm-btn github" type="button" @click="refs.source(p)"><GhEvIcon name="external" size="xs" />GitHub에서 보기</button></div><button v-if="!linked && refs.writes()" type="button" class="gpm-connect" @click="refs.connect(p)"><GhEvIcon name="plus" size="xs" />Case 근거로 연결하기</button></div>
      </template>
    </dialog>
  </div>
</template>
