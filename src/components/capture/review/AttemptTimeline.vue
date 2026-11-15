<script setup lang="ts">
// 02 시도 기록 — 포함 선택·순서 변경·반영 상태(네이티브 텍스트 셀렉트)·수정.
import CapIcon from '@/components/capture/CapIcon.vue'
import MarkdownBody from '@/components/common/MarkdownBody.vue'
import { statusOf, stepBody } from '@/composables/useCaptureReview'
import type { CaptureReview } from '@/composables/useCaptureReview'
import type { CaptureAttempt, CaptureDetail, StepStatus } from '@/types/capture'
import { ATTEMPT_RESULT_LABELS, STEP_STATUS_LABELS } from '@/utils/captureLabels'

const props = defineProps<{ review: CaptureReview; detail: CaptureDetail }>()
const emit = defineEmits<{ 'edit-step': [id: string] }>()

const STEP_OPTIONS = Object.entries(STEP_STATUS_LABELS) as [StepStatus, string][]

function attempt(id: string): CaptureAttempt | undefined {
  return props.review.attemptById.value.get(id)
}
function statusFor(id: string): StepStatus {
  const a = attempt(id)
  return props.review.draft.stepEdits[id]?.status ?? (a ? statusOf(a.result) : 'IN_PROGRESS')
}
function resultLabel(id: string): string {
  const a = attempt(id)
  return a ? ATTEMPT_RESULT_LABELS[a.result] : ''
}
function descFor(id: string): string {
  const a = attempt(id)
  return props.review.draft.stepEdits[id]?.body ?? (a ? stepBody(a) : '')
}
function selected(id: string): boolean {
  return props.review.draft.attempts.includes(id)
}
function fileName(fid: string): string {
  return props.detail.artifacts.find((f) => f.clientArtifactId === fid)?.fileName || fid
}
function edited(id: string): boolean {
  const e = props.review.draft.stepEdits[id]
  return !!(e && (e.title || e.body !== undefined || e.status))
}

function autoIncludeEvidence(ids: string[]) {
  const d = props.review.draft
  for (const fid of ids) {
    if (!d.artifactTouched.includes(fid) && !d.artifacts.includes(fid)) d.artifacts.push(fid)
  }
}
function toggle(id: string, checked: boolean) {
  const d = props.review.draft
  d.attempts = checked ? [...new Set([...d.attempts, id])] : d.attempts.filter((x) => x !== id)
  if (checked) autoIncludeEvidence(attempt(id)?.detail.evidenceRefs ?? [])
  d.dirty = true
}
function selectAll() {
  const d = props.review.draft
  d.attempts = [...d.order]
  autoIncludeEvidence(props.detail.attempts.flatMap((a) => a.detail.evidenceRefs))
  d.dirty = true
}
function selectNone() {
  props.review.draft.attempts = []
  props.review.draft.dirty = true
}
function reorder(id: string, dir: number) {
  const order = props.review.draft.order
  const i = order.indexOf(id)
  const n = i + dir
  if (n < 0 || n >= order.length) return
  ;[order[i], order[n]] = [order[n], order[i]]
  props.review.draft.dirty = true
}
function setStatus(id: string, value: string) {
  props.review.draft.stepEdits[id] = { ...(props.review.draft.stepEdits[id] ?? {}), status: value as StepStatus }
  props.review.draft.dirty = true
}
</script>

<template>
  <section class="section" id="attempts">
    <div class="section-head">
      <h3><span class="num">02</span>시도 기록 <span class="muted small">{{ review.draft.attempts.length }} / {{ detail.attempts.length }}</span></h3>
      <div class="row">
        <button type="button" class="text-btn" @click="selectAll">전체 포함</button>
        <button type="button" class="text-btn" @click="selectNone">전체 제외</button>
      </div>
    </div>
    <p class="small muted" style="margin-bottom: 16px">실패한 시도도 배운 점과 함께 남길 수 있어요. 선택한 순서대로 타임라인에 반영됩니다.</p>

    <div class="timeline">
      <div
        v-for="(id, index) in review.draft.order"
        :key="id"
        class="attempt"
        :class="{ exclude: !selected(id) }"
      >
        <div class="select-col">
          <input
            class="check"
            type="checkbox"
            :aria-label="`${attempt(id)?.detail.title} 포함`"
            :checked="selected(id)"
            @change="toggle(id, ($event.target as HTMLInputElement).checked)"
          />
        </div>
        <div class="attempt-main">
          <span class="led" :class="statusFor(id)" />
          <div class="row between">
            <div class="grow">
              <p class="attempt-title">{{ review.draft.stepEdits[id]?.title ?? attempt(id)?.detail.title }}</p>
              <span class="tiny muted">{{ attempt(id)?.attemptType }} · 원본 결과: {{ resultLabel(id) }}</span>
            </div>
            <div class="row" style="gap: 1px">
              <button type="button" class="iconbtn" aria-label="시도 위로 이동" :disabled="index === 0" @click="reorder(id, -1)"><CapIcon name="up" /></button>
              <button type="button" class="iconbtn" aria-label="시도 아래로 이동" :disabled="index === review.draft.order.length - 1" @click="reorder(id, 1)"><CapIcon name="down" /></button>
            </div>
          </div>

          <div class="attempt-desc">
            <MarkdownBody :content="descFor(id)" />
          </div>

          <div v-if="attempt(id)?.detail.insight" class="insight"><strong>Insight</strong> · {{ attempt(id)?.detail.insight }}</div>

          <div class="file-chips">
            <span
              v-for="fid in attempt(id)?.detail.evidenceRefs ?? []"
              :key="fid"
              class="file-chip"
              :style="!review.draft.artifacts.includes(fid) ? 'text-decoration: line-through; opacity: .6' : ''"
            ><CapIcon name="file" />{{ fileName(fid) }}</span>
          </div>

          <div class="attempt-footer">
            <span class="status-editor">
              <span class="status-editor-title">반영 상태</span>
              <label class="status-text-native" :class="statusFor(id)">
                <span class="sr-only">{{ attempt(id)?.detail.title }} 반영 상태</span>
                <select
                  :disabled="!selected(id)"
                  :value="statusFor(id)"
                  @change="setStatus(id, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="[k, label] in STEP_OPTIONS" :key="k" :value="k">{{ label }}</option>
                </select>
                <CapIcon name="down" />
              </label>
            </span>
            <span class="grow" />
            <span v-if="edited(id)" class="badge green">수정됨</span>
            <button type="button" class="text-btn" :disabled="!selected(id)" @click="emit('edit-step', id)">수정</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
