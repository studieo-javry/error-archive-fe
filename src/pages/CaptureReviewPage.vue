<script setup lang="ts">
/**
 * Capture 상세/검토. GET /captures/{uuid} 로 초안을 불러온다(본인 소유 아니면 404).
 *
 * 이 커밋 범위: 로더(로딩/404/오류) + 읽기 전용 상세(수집 원본·시도·해결책·근거). 검토 이력의 "기록 보기"와
 * 반영/폐기된 원본 열람에 바로 쓰인다. READY_FOR_REVIEW 의 인터랙티브 검토·정정·반영(import) 편집기는
 * 다음 단위(리뷰 스파인)에서 이 페이지에 올린다.
 */
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isAxiosError } from 'axios'
import CapIcon from '@/components/capture/CapIcon.vue'
import MarkdownBody from '@/components/common/MarkdownBody.vue'
import { captureApi } from '@/services/captureApi'
import { defaultBody, stepBody } from '@/composables/useCaptureReview'
import type { CaptureDetail, Verification } from '@/types/capture'
import {
  ATTEMPT_RESULT_LABELS,
  CAPTURE_STATE_LABELS,
  VERIFICATION_RESULT_LABELS,
} from '@/utils/captureLabels'

const route = useRoute()
const router = useRouter()

const detail = ref<CaptureDetail | null>(null)
const loading = ref(false)
const notFound = ref(false)
const loadError = ref(false)

async function load(uuid: string) {
  loading.value = true
  notFound.value = false
  loadError.value = false
  detail.value = null
  try {
    const { data } = await captureApi.detail(uuid)
    detail.value = data
  } catch (e) {
    if (isAxiosError(e) && e.response?.status === 404) notFound.value = true
    else loadError.value = true
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params.uuid,
  (uuid) => {
    if (typeof uuid === 'string') load(uuid)
  },
  { immediate: true },
)

function backToInbox() {
  router.push({ name: 'captureInbox' })
}
function stateTone(): string {
  const s = detail.value?.capture.status
  return s === 'READY_FOR_REVIEW' ? 'green' : s === 'IMPORTED' ? 'blue' : ''
}
function verifyTone(v: Verification): string {
  return v.result === 'PASSED' ? 'green' : v.result === 'FAILED' ? 'rose' : 'amber'
}
</script>

<template>
  <div class="cap page wide">
    <button type="button" class="cap-back" @click="backToInbox"><CapIcon name="back" />검토 대기함</button>

    <div v-if="loading" class="card">
      <div class="loading" style="width: 40%" />
      <div class="loading" style="width: 80%" />
      <p class="small muted">초안을 불러오고 있어요…</p>
    </div>

    <div v-else-if="notFound" class="empty">
      <div class="empty-icon"><CapIcon name="inbox" /></div>
      <h2 class="serif">Record unavailable.</h2>
      <p>기록을 찾을 수 없거나 접근할 수 없습니다.</p>
      <button type="button" class="btn primary" @click="backToInbox">목록으로 돌아가기</button>
    </div>

    <div v-else-if="loadError" class="notice rose" role="alert">
      초안을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.<br />
      <button type="button" class="btn small" @click="load(String(route.params.uuid))"><CapIcon name="refresh" />다시 불러오기</button>
    </div>

    <template v-else-if="detail">
      <div class="row wrap">
        <span class="badge" :class="stateTone()">{{ CAPTURE_STATE_LABELS[detail.capture.status] }}</span>
        <span class="badge"><CapIcon name="lock" />나만 볼 수 있음</span>
        <span class="tiny muted">{{ detail.capture.project }} · {{ detail.capture.updatedAt.slice(0, 10) }}</span>
      </div>
      <h1 class="cap-detail-title">{{ detail.capture.title || '(제목 없음)' }}</h1>

      <div v-if="detail.capture.status === 'READY_FOR_REVIEW'" class="notice neutral" style="margin: 10px 0 24px">
        이 초안은 검토 대기 상태입니다. 선택·정정·반영(import) 편집 기능은 곧 제공됩니다. 아래는 수집된 원본 내용입니다.
      </div>

      <!-- 수집 원본 본문 -->
      <div class="card">
        <MarkdownBody :content="defaultBody(detail.capture.content)" />
      </div>

      <!-- 시도 -->
      <section class="cap-section">
        <h3 class="cap-section-head">수집된 시도 {{ detail.attempts.length }}건</h3>
        <div v-for="a in detail.attempts" :key="a.clientAttemptId" class="card cap-stacked">
          <div class="row between">
            <h3>{{ a.detail.title }}</h3>
            <span class="badge">{{ ATTEMPT_RESULT_LABELS[a.result] }}</span>
          </div>
          <MarkdownBody v-if="stepBody(a)" :content="stepBody(a)" class="cap-mt" />
          <div v-if="a.detail.insight" class="cap-insight"><strong>Insight</strong> · {{ a.detail.insight }}</div>
        </div>
        <p v-if="!detail.attempts.length" class="small muted">기록된 시도가 없습니다.</p>
      </section>

      <!-- 해결책 -->
      <section class="cap-section">
        <h3 class="cap-section-head">수집된 해결책 {{ detail.solutions.length }}건</h3>
        <div v-for="s in detail.solutions" :key="s.clientSolutionId" class="card cap-stacked">
          <h3>{{ s.title }}</h3>
          <p v-if="s.content.description" class="small muted cap-mt">{{ s.content.description }}</p>
          <div v-if="s.content.verification" class="cap-verify">
            <div class="row between">
              <span class="tiny muted">검증 결과</span>
              <div class="row" style="gap: 5px">
                <span class="badge" :class="verifyTone(s.content.verification)">
                  {{ VERIFICATION_RESULT_LABELS[s.content.verification.result] }}
                </span>
                <span class="badge">{{ s.content.verification.scope || '범위 미지정' }}</span>
              </div>
            </div>
            <pre v-if="s.content.verification.command" class="cap-verify-pre">{{ s.content.verification.command }}</pre>
            <p v-if="s.content.verification.evidence" class="small">{{ s.content.verification.evidence }}</p>
            <div class="cap-verify-grid">
              <span>{{ s.content.verification.executed ? '실제 실행함' : '실행하지 않음' }}</span>
              <span v-if="s.content.verification.testId">Test · {{ s.content.verification.testId }}</span>
              <span v-if="s.content.verification.commitSha">Commit · {{ s.content.verification.commitSha }}</span>
              <span v-if="s.content.verification.ranAt">{{ s.content.verification.ranAt }}</span>
            </div>
          </div>
        </div>
        <p v-if="!detail.solutions.length" class="small muted">기록된 해결책이 없습니다.</p>
      </section>

      <!-- 근거 파일 -->
      <section class="cap-section">
        <h3 class="cap-section-head">근거 파일 {{ detail.artifacts.length }}개</h3>
        <div class="cap-chips">
          <span v-for="f in detail.artifacts" :key="f.clientArtifactId" class="cap-chip">
            <CapIcon :name="f.contentType.startsWith('image') ? 'image' : 'file'" />{{ f.fileName || f.clientArtifactId }}
          </span>
        </div>
        <p v-if="!detail.artifacts.length" class="small muted">첨부된 파일이 없습니다.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.cap-back { display: flex; align-items: center; gap: 6px; border: 0; background: none; padding: 0; color: var(--muted); font-size: 12px; margin-bottom: 25px; cursor: pointer; }
.cap-back svg { width: 15px; height: 15px; }
.cap-detail-title { font-size: 27px; letter-spacing: -0.035em; line-height: 1.5; margin: 12px 0; }
.cap-section { margin-top: 25px; }
.cap-section-head { margin-bottom: 15px; }
.cap-stacked { margin-bottom: 12px; }
.cap-mt { margin-top: 10px; }
.cap-insight { margin-top: 12px; border: 1px solid color-mix(in srgb, var(--amber) 20%, transparent); background: var(--amber-bg); color: var(--amber); padding: 9px 12px; border-radius: 7px; font-size: 11px; }
.cap-verify { background: var(--bg); border-radius: 8px; padding: 15px; margin-top: 15px; }
.cap-verify-pre { font-size: 11px; white-space: pre-wrap; margin: 10px 0; overflow-wrap: anywhere; color: var(--muted); }
.cap-verify-grid { display: flex; gap: 18px; flex-wrap: wrap; font-size: 11px; color: var(--muted); margin-top: 9px; }
.cap-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.cap-chip { font-size: 10px; border: 1px solid var(--line); border-radius: 5px; padding: 3px 7px; color: var(--muted); display: flex; align-items: center; gap: 5px; }
.cap-chip svg { width: 12px; height: 12px; }
</style>
