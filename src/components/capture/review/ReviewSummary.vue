<script setup lang="ts">
// 반영 요약(sticky) — 선택 요약·해결 표시·검증 룰·반영 버튼·충돌 회복.
import CapIcon from '@/components/capture/CapIcon.vue'
import type { CaptureReview } from '@/composables/useCaptureReview'

export type SubmitError = 'revision' | 'network' | 'duplicate' | null

const props = defineProps<{
  review: CaptureReview
  step: 'review' | 'preview'
  busy: boolean
  submitError: SubmitError
  hasSubmission: boolean
  latestSeen: boolean
  /** 반영 프로젝트 라벨(Phase 2). 미지정이면 kv 생략. */
  projectLabel?: string
}>()
const emit = defineEmits<{
  preview: []
  import: []
  'back-review': []
  'go-queue': []
  latest: []
  'retry-import': []
  'existing-case': []
}>()

function setResolved(checked: boolean) {
  props.review.draft.markResolved = checked
  props.review.draft.dirty = true
}
</script>

<template>
  <aside class="summary" aria-label="반영 요약">
    <div class="row between">
      <h3>반영할 내용</h3>
      <span class="badge green"><CapIcon name="lock" />비공개</span>
    </div>
    <div class="kv"><span>저장 위치</span><strong>Personal</strong></div>
    <div class="kv"><span>새 Case</span><strong>1건</strong></div>
    <div class="kv"><span>시도 / 해결책</span><strong>{{ review.draft.attempts.length }} / {{ review.draft.solutions.length }}</strong></div>
    <div class="kv"><span>근거 파일</span><strong>{{ review.draft.artifacts.length }}개</strong></div>
    <div v-if="projectLabel" class="kv"><span>프로젝트</span><strong class="small">{{ projectLabel }}</strong></div>

    <div class="divider" />
    <label class="choice">
      <input
        class="check"
        type="checkbox"
        :disabled="busy || !!submitError"
        :checked="review.draft.markResolved"
        @change="setResolved(($event.target as HTMLInputElement).checked)"
      />
      <span>해결된 문제로 표시<small class="muted" style="display: block">내가 해결 여부를 확인했어요.</small></span>
    </label>
    <div class="kv" style="margin-top: 7px">
      <span>Case 상태</span>
      <span class="badge" :class="review.draft.markResolved ? 'green' : 'blue'">{{ review.draft.markResolved ? 'Resolved' : 'Open' }}</span>
    </div>
    <p class="hint">기본은 Open으로 남습니다. 검증이 통과해도 자동으로 해결 처리하지 않아요.</p>

    <div class="divider" />

    <div v-if="review.errors.value.length" class="error-list" role="alert">
      <p v-for="(e, i) in review.errors.value" :key="i">{{ e }}</p>
    </div>

    <!-- 충돌 회복 패널 -->
    <div v-if="submitError === 'revision'" class="notice amber" role="alert">
      다른 요청으로 기록이 변경됐어요. 편집한 내용은 유지하고 있습니다.<br />
      <button type="button" class="btn small" @click="emit('latest')">{{ latestSeen ? '최신 원본 확인 완료' : '최신 원본 확인' }}</button>
    </div>
    <div v-else-if="submitError === 'network'" class="notice amber" role="alert">
      서버의 처리 결과를 확인하지 못했어요. 같은 내용으로 다시 확인해 주세요.<br />
      <button type="button" class="btn small" @click="emit('retry-import')">같은 요청으로 재시도</button>
    </div>
    <div v-else-if="submitError === 'duplicate'" class="notice blue" role="alert">
      다른 화면에서 이미 반영된 기록이에요.<br />
      <button type="button" class="btn small" @click="emit('existing-case')">기존 Case 보기</button>
    </div>

    <div class="summary-actions">
      <button
        type="button"
        class="btn primary"
        :disabled="busy || !!submitError || review.errors.value.length > 0"
        @click="step === 'preview' ? emit('import') : emit('preview')"
      >
        <span v-if="busy" class="spinner" />
        <template v-if="busy">처리 중…</template>
        <template v-else-if="step === 'preview'">새 Case로 반영 <CapIcon name="arrow" /></template>
        <template v-else>반영 미리보기 <CapIcon name="arrow" /></template>
      </button>
      <button type="button" class="btn ghost" :disabled="busy" @click="step === 'preview' ? emit('back-review') : emit('go-queue')">
        {{ step === 'preview' ? '검토로 돌아가기' : '나중에 검토' }}
      </button>
    </div>
    <p class="hint">{{ hasSubmission ? '제출한 요청을 보관하고 있어요.' : '선택·수정은 최종 반영할 때 적용됩니다.' }}</p>
  </aside>
</template>
