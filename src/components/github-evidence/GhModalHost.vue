<script setup lang="ts">
// 목업 renderAdd · confirmDetach · openTagStep · backfillCompletion 모달과 toast.
import { computed, nextTick, ref, watch } from 'vue'
import GhDialog from './GhDialog.vue'
import GhEvIcon from './GhEvIcon.vue'
import GhNotice from './GhNotice.vue'
import { kindName, parseUrl, shortRef, statusName, useCaseGithub } from '@/composables/useCaseGithub'
import type { Step } from '@/types/error'

const props = defineProps<{ steps: Step[]; spaceName: string }>()
const g = useCaseGithub()
const m = computed(() => g.modal.value)
const close = () => (g.modal.value = null)

// ── GitHub 근거 연결 ──
const draftUrl = ref('')
const modalError = ref('')
const urlInput = ref<HTMLInputElement | null>(null)
let busy = false
watch(() => m.value?.type, async t => {
  if (t !== 'add') return
  draftUrl.value = (m.value?.type === 'add' && m.value.url) || ''
  modalError.value = ''
  await nextTick()
  urlInput.value?.focus()
})
const parsed = computed(() => parseUrl(draftUrl.value))
async function confirmAdd() {
  if (busy) return
  busy = true
  try {
    const err = await g.addEvidence(draftUrl.value)
    if (err) modalError.value = err
  } finally {
    busy = false
  }
}

// ── 연결 해제 ──
const detaching = computed(() => {
  const v = m.value
  return v?.type === 'detach' ? g.items.value.find(i => i.id === v.id) ?? null : null
})

// ── Step 근거 연결 ──
const tagging = computed(() => {
  const v = m.value
  return v?.type === 'tag' ? props.steps.find(s => s.id === v.stepId) ?? null : null
})
const picked = ref<number[]>([])
watch(tagging, s => {
  picked.value = s ? g.items.value.filter(x => !x.masked && x.stepIds.includes(s.id)).map(x => x.id) : []
})
const others = (stepIds: number[], sid: number) => stepIds.filter(i => i !== sid)

// ── 연결 완료 ──
const backfill = computed(() => (m.value?.type === 'backfill' ? m.value : null))
</script>

<template>
  <GhDialog v-if="m?.type === 'add'" title="GitHub 근거 연결" @close="close">
    <p class="modal-desc">문제와 관련된 Issue 또는 Pull request 주소를 붙여넣으세요. 이 Case가 속한 공간에 연결된 저장소를 사용할 수 있어요.</p>
    <div class="row text-xs muted"><GhEvIcon name="users" size="sm" /><span>Case 공간 · <strong>{{ spaceName }}</strong></span></div>
    <label class="field-label" for="gh-url">GitHub URL</label>
    <input id="gh-url" ref="urlInput" v-model="draftUrl" class="url-input" maxlength="500" type="url" placeholder="https://github.com/owner/repo/pull/123" autocomplete="off" @keydown.enter.prevent="confirmAdd">
    <p class="help">Issue·PR을 먼저 Case에 연결한 뒤, 원하는 Step에도 붙일 수 있어요.</p>
    <div id="url-preview">
      <template v-if="draftUrl">
        <GhNotice v-if="!parsed" cls="error" icon="alert">github.com의 Issue 또는 Pull request 주소를 입력해 주세요.</GhNotice>
        <GhNotice v-else icon="link"><strong>주소 형식 확인</strong><br>{{ parsed.repo }} · {{ kindName(parsed) }} #{{ parsed.number }}<br><span class="soft-text">대상과 접근 권한은 연결할 때 확인합니다.</span></GhNotice>
      </template>
    </div>
    <GhNotice v-if="modalError" cls="error" icon="alert">{{ modalError }}</GhNotice>
    <template #footer><button class="btn" @click="close">취소</button><button class="btn primary" @click="confirmAdd">연결하기</button></template>
  </GhDialog>

  <GhDialog v-else-if="m?.type === 'detach' && detaching" title="근거 연결을 해제할까요?" @close="close">
    <p class="modal-desc"><strong>{{ detaching.repo }} #{{ detaching.number }}</strong><br>{{ detaching.title }}</p>
    <p class="text-xs muted" style="line-height:1.8">Case와의 연결을 해제합니다. GitHub의 Issue·PR은 삭제되지 않고, 기존 연결 이력은 남습니다.</p>
    <GhNotice v-if="detaching.stepIds.length" cls="warn" icon="link">Step {{ detaching.stepIds.map(g.stepNo).join('·') }}의 근거 배지도 함께 사라집니다. 같은 주소를 다시 연결해도 Step 연결은 복구되지 않아요.</GhNotice>
    <p class="help" style="margin-top:12px">같은 주소를 다시 붙이면 Case 연결을 복구할 수 있어요.{{ detaching.kind === 'ISSUE' ? ' 다른 PR의 연결은 그대로 유지됩니다.' : '' }}</p>
    <template #footer><button class="btn" @click="close">취소</button><button class="btn danger" @click="g.detach(detaching.id)">연결 해제</button></template>
  </GhDialog>

  <GhDialog v-else-if="m?.type === 'tag' && tagging" :title="`Step ${g.stepNo(tagging.id)} · 근거 연결`" @close="close">
    <p class="modal-desc">{{ tagging.title }}<br>이 Case에 연결된 근거 중 이 시도를 뒷받침하는 항목을 골라 주세요.</p>
    <div v-if="g.items.value.length" class="option-list">
      <template v-for="x in g.items.value" :key="x.id">
        <label v-if="x.masked" class="option-row"><input type="checkbox" class="custom-checkbox" disabled :checked="x.stepIds.includes(tagging.id)"><div><strong><GhEvIcon name="lock" size="xs" />비공개 {{ kindName(x) }} · {{ statusName(x.status) }}</strong><p>열람할 수 없는 근거의 연결은 유지됩니다.</p></div></label>
        <label v-else class="option-row"><input v-model="picked" type="checkbox" class="custom-checkbox" name="step-link" :value="x.id"><div><strong>{{ shortRef(x) }} · {{ x.title }}</strong><p>{{ x.repo }} · {{ statusName(x.status) }}{{ x.privacy ? ' · Private' : '' }}{{ others(x.stepIds, tagging.id).length ? ` · Step ${others(x.stepIds, tagging.id).map(g.stepNo).join('·')}에도 연결됨` : '' }}</p></div></label>
      </template>
    </div>
    <GhNotice v-else>먼저 Issue 또는 PR을 Case에 연결해 주세요.</GhNotice>
    <p class="help" style="margin-top:12px">하나의 근거를 여러 Step에 연결할 수 있어요.<br>선택을 모두 해제해도 Case의 근거는 유지됩니다.</p>
    <button class="text-action accent" style="margin-top:12px" @click="g.startAdd()"><GhEvIcon name="plus" size="xs" />새 GitHub 근거를 Case에 연결</button>
    <template #footer><button class="btn" @click="close">취소</button><button class="btn primary" :disabled="!g.items.value.length" @click="g.saveTag(tagging.id, picked)">저장</button></template>
  </GhDialog>

  <GhDialog v-else-if="backfill" title="GitHub 근거 연결 완료" @close="close">
    <div class="gh-complete-head"><span class="gh-complete-icon"><GhEvIcon name="check" size="sm" /></span><div class="grow"><p class="gh-complete-title">Issue #{{ backfill.issueNumber }}이 연결되었어요</p><p class="gh-complete-sub"><template v-if="backfill.linked.length">이 Issue를 닫는 <template v-for="(pr, i) in backfill.linked" :key="pr.repo + pr.number">{{ i ? ', ' : '' }}<strong>PR #{{ pr.number }}</strong></template>도 발견되어 <b>Case의 근거로 함께 연결</b>했어요.</template><template v-else>이 Issue를 Case의 GitHub 근거로 연결했어요.</template></p></div></div>
    <template v-if="backfill.linked.length">
      <div class="gh-complete-list"><div class="gh-complete-row"><GhEvIcon name="issue" size="sm" /><div class="grow"><strong>Issue #{{ backfill.issueNumber }}</strong><span>Case에 연결됨</span></div></div><div v-for="pr in backfill.linked" :key="pr.repo + pr.number" class="gh-complete-row pr"><GhEvIcon name="pr" size="sm" /><div class="grow"><strong>PR #{{ pr.number }}</strong><span>{{ pr.title }}</span><span class="auto-link-pill emphasis"><GhEvIcon name="github" size="xs" />자동 연결</span></div><span class="badge" :class="pr.state === 'MERGED' ? 'green' : ''">{{ statusName(pr.state) }}</span></div></div>
      <p class="gh-complete-origin"><span class="auto-link-pill emphasis"><GhEvIcon name="github" size="xs" />자동 연결</span> <b>왜 함께 연결됐나요?</b> GitHub에서 이 Issue를 닫는 PR 관계를 확인했기 때문이에요. PR을 새로 생성한 것은 아니에요.</p>
    </template>
    <p v-if="backfill.skipped.length" class="help" style="margin-top:10px">이전에 연결을 해제한 PR {{ backfill.skipped.map(n => '#' + n.number).join(', ') }}은 다시 연결하지 않았어요.</p>
    <template #footer><button class="btn" @click="close">닫기</button><button class="btn primary" @click="g.confirmBackfill(backfill.issueId)">{{ backfill.linked.length ? '연결된 근거 확인' : 'Issue 확인' }} <GhEvIcon name="arrow" size="xs" /></button></template>
  </GhDialog>

  <Teleport to="body">
    <div class="gh-ev"><div id="toast" class="toast" role="status" :hidden="!g.toastText.value">{{ g.toastText.value }}</div></div>
  </Teleport>
</template>
