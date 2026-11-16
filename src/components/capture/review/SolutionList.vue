<script setup lang="ts">
// 03 해결책 후보 — 포함 선택·검증 편집·연결 시도 표시.
import VerifyBlock from './VerifyBlock.vue'
import type { CaptureReview } from '@/composables/useCaptureReview'
import type { CaptureDetail, CaptureSolution } from '@/types/capture'

const props = defineProps<{ review: CaptureReview; detail: CaptureDetail }>()
const emit = defineEmits<{ 'edit-solution': [id: string] }>()

function selected(id: string): boolean {
  return props.review.draft.solutions.includes(id)
}
function toggle(id: string, checked: boolean) {
  const d = props.review.draft
  d.solutions = checked ? [...new Set([...d.solutions, id])] : d.solutions.filter((x) => x !== id)
  d.dirty = true
}
function attemptOrder(id: string): number {
  return props.review.draft.order.indexOf(id) + 1
}
function attemptIncluded(id: string): boolean {
  return props.review.draft.attempts.includes(id)
}
function linkedCount(s: CaptureSolution): number {
  return s.content.clientAttemptIds.filter((id) => props.review.draft.attempts.includes(id)).length
}
function includeRelated(s: CaptureSolution) {
  const d = props.review.draft
  for (const aid of s.content.clientAttemptIds) {
    if (!d.attempts.includes(aid)) d.attempts.push(aid)
    const a = props.review.attemptById.value.get(aid)
    for (const fid of a?.detail.evidenceRefs ?? []) {
      if (!d.artifactTouched.includes(fid) && !d.artifacts.includes(fid)) d.artifacts.push(fid)
    }
  }
  d.dirty = true
}
</script>

<template>
  <section class="section" id="solutions">
    <div class="section-head">
      <h3><span class="num">03</span>해결책 후보 <span class="muted small">{{ review.draft.solutions.length }} / {{ detail.solutions.length }}</span></h3>
    </div>

    <template v-if="detail.solutions.length">
      <div v-for="s in detail.solutions" :key="s.clientSolutionId" class="solution" :class="{ exclude: !selected(s.clientSolutionId) }">
        <div class="row">
          <input
            class="check"
            type="checkbox"
            :aria-label="`${s.title} 포함`"
            :checked="selected(s.clientSolutionId)"
            @change="toggle(s.clientSolutionId, ($event.target as HTMLInputElement).checked)"
          />
          <h3 class="grow">{{ review.solutionValue(s).title }}</h3>
          <button type="button" class="text-btn" :disabled="!selected(s.clientSolutionId)" @click="emit('edit-solution', s.clientSolutionId)">수정</button>
        </div>
        <p class="small muted" style="margin-top: 12px">{{ review.solutionValue(s).description }}</p>

        <div class="file-chips">
          <span
            v-for="id in s.content.clientAttemptIds"
            :key="id"
            class="badge"
            :class="attemptIncluded(id) ? 'green' : ''"
          >시도 {{ attemptOrder(id) }}{{ attemptIncluded(id) ? ' 포함' : ' 제외' }}</span>
        </div>

        <div v-if="selected(s.clientSolutionId) && !linkedCount(s)" class="notice rose" style="margin-top: 12px">
          연결할 시도가 없어요. 관련 시도를 1개 이상 포함해 주세요.<br />
          <button type="button" class="btn small" @click="includeRelated(s)">관련 시도 포함</button>
        </div>

        <VerifyBlock :verification="review.solutionValue(s).verification" />
      </div>
    </template>
    <div v-else class="notice neutral">아직 해결책 후보가 없습니다. 조사한 경과만 새 Case로 남길 수 있어요.</div>
  </section>
</template>
