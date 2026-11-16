<script setup lang="ts">
// 반영 미리보기 — 선택·정정이 반영된 최종 Case 모습(Resolution Timeline).
import { computed } from 'vue'
import CapIcon from '@/components/capture/CapIcon.vue'
import MarkdownBody from '@/components/common/MarkdownBody.vue'
import CaptureBodyRenderer from './CaptureBodyRenderer.vue'
import VerifyBlock from './VerifyBlock.vue'
import { statusOf, stepBody } from '@/composables/useCaptureReview'
import type { CaptureReview } from '@/composables/useCaptureReview'
import type { CaptureArtifact, CaptureAttempt, CaptureDetail, StepStatus } from '@/types/capture'
import { STEP_STATUS_LABELS } from '@/utils/captureLabels'

const props = defineProps<{ review: CaptureReview; detail: CaptureDetail }>()

function statusFor(a: CaptureAttempt): StepStatus {
  return props.review.draft.stepEdits[a.clientAttemptId]?.status ?? statusOf(a.result)
}
function titleFor(a: CaptureAttempt): string {
  return props.review.draft.stepEdits[a.clientAttemptId]?.title ?? a.detail.title
}
function bodyFor(a: CaptureAttempt): string {
  return props.review.draft.stepEdits[a.clientAttemptId]?.body ?? stepBody(a)
}
function filesFor(a: CaptureAttempt): CaptureArtifact[] {
  const map = props.review.assignments.value
  return props.detail.artifacts.filter((f) => map[f.clientArtifactId] === a.clientAttemptId)
}
const selectedSolutions = computed(() =>
  props.detail.solutions.filter((s) => props.review.draft.solutions.includes(s.clientSolutionId)),
)
const relatedArtifacts = computed<CaptureArtifact[]>(() => {
  const map = props.review.assignments.value
  return props.detail.artifacts.filter((f) => props.review.draft.artifacts.includes(f.clientArtifactId) && !map[f.clientArtifactId])
})
</script>

<template>
  <div class="card">
    <div class="row wrap">
      <span class="badge"><CapIcon name="lock" />Private</span>
      <span class="badge" :class="review.draft.markResolved ? 'green' : 'blue'">{{ review.draft.markResolved ? 'Resolved' : 'Open' }}</span>
      <span class="tiny muted">{{ detail.capture.project }}</span>
    </div>
    <h2 class="preview-title">{{ review.draft.title }}</h2>
    <div class="preview-body"><CaptureBodyRenderer :body="review.draft.body" :snippets="detail.capture.content.snippets" :artifacts="detail.artifacts" /></div>

    <div class="divider" />
    <h2 class="serif" style="font-size: 24px; margin-bottom: 22px">Resolution Timeline</h2>
    <div class="timeline">
      <div v-for="a in review.chosenAttempts.value" :key="a.clientAttemptId" class="attempt">
        <div class="attempt-main">
          <span class="led" :class="statusFor(a)" />
          <div class="row between">
            <h3>{{ titleFor(a) }}</h3>
            <span class="preview-status-text" :class="statusFor(a)">{{ STEP_STATUS_LABELS[statusFor(a)] }}</span>
          </div>
          <div class="preview-body small"><MarkdownBody :content="bodyFor(a)" /></div>
          <div v-if="a.detail.insight" class="insight">Insight · {{ a.detail.insight }}</div>
          <div v-if="filesFor(a).length" class="file-chips">
            <span v-for="f in filesFor(a)" :key="f.clientArtifactId" class="file-chip"><CapIcon name="file" />{{ f.fileName || f.clientArtifactId }}</span>
          </div>
        </div>
      </div>
    </div>

    <template v-for="s in selectedSolutions" :key="s.clientSolutionId">
      <div class="divider" />
      <div class="row" style="margin-bottom: 12px">
        <span class="badge green">Solution</span>
        <h3>{{ review.solutionValue(s).title }}</h3>
      </div>
      <p class="small muted">{{ review.solutionValue(s).description }}</p>
      <VerifyBlock :verification="review.solutionValue(s).verification" />
    </template>

    <template v-if="relatedArtifacts.length">
      <div class="divider" />
      <h3>관련 첨부</h3>
      <div class="file-chips">
        <span v-for="f in relatedArtifacts" :key="f.clientArtifactId" class="file-chip"><CapIcon name="file" />{{ f.fileName || f.clientArtifactId }}</span>
      </div>
    </template>
  </div>
</template>
