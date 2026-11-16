<script setup lang="ts">
// 04 근거 파일 — 명시 선택. 여러 시도가 참조한 파일은 처음 참조한 선택 시도 아래 한 번 배치.
import CapIcon from '@/components/capture/CapIcon.vue'
import type { CaptureReview } from '@/composables/useCaptureReview'
import type { CaptureArtifact, CaptureDetail } from '@/types/capture'

const props = defineProps<{ review: CaptureReview; detail: CaptureDetail }>()
const emit = defineEmits<{ 'file-info': [id: string] }>()

function included(id: string): boolean {
  return props.review.draft.artifacts.includes(id)
}
function toggle(id: string, checked: boolean) {
  const d = props.review.draft
  d.artifacts = checked ? [...new Set([...d.artifacts, id])] : d.artifacts.filter((x) => x !== id)
  d.artifactTouched = [...new Set([...d.artifactTouched, id])]
  d.dirty = true
}
function placement(f: CaptureArtifact): string {
  if (!included(f.clientArtifactId)) return '반영에서 제외'
  const assignedTo = props.review.assignments.value[f.clientArtifactId]
  if (!assignedTo) return '관련 첨부에 반영'
  const idx = props.review.chosenAttempts.value.findIndex((a) => a.clientAttemptId === assignedTo)
  return `시도 ${idx + 1} 아래에 반영`
}
function sizeKb(bytes: number): string {
  return (bytes / 1024).toFixed(0)
}
</script>

<template>
  <section class="section" id="artifacts">
    <div class="section-head">
      <h3><span class="num">04</span>근거 파일 <span class="muted small">{{ review.draft.artifacts.length }} / {{ detail.artifacts.length }}</span></h3>
    </div>
    <p class="small muted" style="margin-bottom: 9px">선택한 파일만 반영합니다. 여러 시도가 참조한 파일은 처음 참조하는 시도에 한 번 배치됩니다.</p>

    <template v-if="detail.artifacts.length">
      <div v-for="f in detail.artifacts" :key="f.clientArtifactId" class="file-row">
        <input
          class="check"
          type="checkbox"
          :aria-label="`${f.fileName} 포함`"
          :checked="included(f.clientArtifactId)"
          @change="toggle(f.clientArtifactId, ($event.target as HTMLInputElement).checked)"
        />
        <div class="file-icon"><CapIcon :name="f.contentType.startsWith('image') ? 'image' : 'file'" /></div>
        <div class="grow">
          <div class="file-name">{{ f.fileName || f.clientArtifactId }}</div>
          <span class="tiny muted">{{ sizeKb(f.sizeBytes) }} KB · {{ f.contentType }} · {{ placement(f) }}</span>
        </div>
        <button type="button" class="btn ghost small" @click="emit('file-info', f.clientArtifactId)">파일 정보</button>
      </div>
      <p class="tiny muted" style="margin-top: 13px">현재는 파일 정보만 확인할 수 있어요. 내용 미리보기는 아직 지원되지 않습니다.</p>
    </template>
    <div v-else class="notice neutral">이 기록에 첨부된 파일이 없습니다.</div>
  </section>
</template>
