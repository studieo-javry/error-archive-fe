<script setup lang="ts">
/**
 * Capture 검토/반영. GET /captures/{uuid} 로 초안을 불러와(본인 소유 아니면 404) 사람이 검토·정정한 뒤
 * 신규 비공개 ErrorCase 로 반영(import)한다.
 *  - READY_FOR_REVIEW: 인터랙티브 편집기(검토 → 미리보기 → 반영) + 폐기
 *  - 그 외 상태(IMPORTED/DISCARDED/OPEN): 읽기 뷰(+ 복원/Case 보기)
 * 반영은 Idempotency-Key 로 멱등. 충돌 3종(revision/응답 유실/다른 탭 중복)을 회복 UI 로 처리.
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isAxiosError } from 'axios'
import CapIcon from '@/components/capture/CapIcon.vue'
import CapModal from '@/components/capture/CapModal.vue'
import MarkdownBody from '@/components/common/MarkdownBody.vue'
import ContextCard from '@/components/capture/review/ContextCard.vue'
import AttemptTimeline from '@/components/capture/review/AttemptTimeline.vue'
import SolutionList from '@/components/capture/review/SolutionList.vue'
import ArtifactList from '@/components/capture/review/ArtifactList.vue'
import ReviewSummary from '@/components/capture/review/ReviewSummary.vue'
import ReviewStepper from '@/components/capture/review/ReviewStepper.vue'
import PreviewContent from '@/components/capture/review/PreviewContent.vue'
import VerifyBlock from '@/components/capture/review/VerifyBlock.vue'
import { captureApi } from '@/services/captureApi'
import { defaultBody, stepBody, useCaptureReview } from '@/composables/useCaptureReview'
import { useCaptureToast } from '@/composables/useCaptureToast'
import { useTeamStore } from '@/stores/teamStore'
import type { CaptureArtifact, CaptureDetail, VerificationResult, VerificationScope } from '@/types/capture'
import { ATTEMPT_RESULT_LABELS, CAPTURE_STATE_LABELS } from '@/utils/captureLabels'

type SubmitError = 'revision' | 'network' | 'duplicate' | null
type ModalKind = 'edit-context' | 'edit-step' | 'edit-solution' | 'file-info' | 'original' | 'request' | 'discard' | null

const route = useRoute()
const router = useRouter()
const teamStore = useTeamStore()
const { toast } = useCaptureToast()

const detail = ref<CaptureDetail | null>(null)
const loading = ref(false)
const notFound = ref(false)
const loadError = ref(false)

const review = useCaptureReview(detail)

const step = ref<'review' | 'preview' | 'success'>('review')
const busy = ref(false)
const submitError = ref<SubmitError>(null)
const submission = ref<{ key: string; payload: ReturnType<typeof review.payload> } | null>(null)
const latestSeen = ref(false)
const importedCaseId = ref<number | null>(null)

const uuid = computed(() => String(route.params.uuid))
const isReady = computed(() => detail.value?.capture.status === 'READY_FOR_REVIEW')

async function load(id: string) {
  loading.value = true
  notFound.value = false
  loadError.value = false
  detail.value = null
  try {
    const { data } = await captureApi.detail(id)
    detail.value = data
    review.reset(data)
    step.value = 'review'
    submitError.value = null
    submission.value = null
    latestSeen.value = false
    importedCaseId.value = null
  } catch (e) {
    if (isAxiosError(e) && e.response?.status === 404) notFound.value = true
    else loadError.value = true
  } finally {
    loading.value = false
  }
}

watch(() => route.params.uuid, (id) => { if (typeof id === 'string') load(id) }, { immediate: true })

function backToInbox() {
  router.push({ name: 'captureInbox' })
}
function caseLink(id: number) {
  return { name: 'errorDetail', params: { slug: teamStore.currentSlug, id } }
}

// ── 반영(import) ───────────────────────────────────────────────────────────
function goPreview() {
  if (review.errors.value.length) return
  step.value = 'preview'
}
function backReview() {
  if (submitError.value === 'network') {
    toast('먼저 동일 요청의 처리 결과를 확인해 주세요.')
    return
  }
  step.value = 'review'
}

async function doImport(retry = false) {
  if (busy.value) return
  if (review.errors.value.length) {
    toast('확인이 필요한 항목을 먼저 수정해 주세요.')
    return
  }
  if (submitError.value === 'duplicate') return
  if (submitError.value === 'revision') {
    toast('최신 원본을 확인하고 다시 검토해 주세요.')
    return
  }
  if (submitError.value === 'network' && !retry) {
    toast('같은 요청으로 재시도 버튼을 눌러 주세요.')
    return
  }
  if (!submission.value) {
    submission.value = { key: crypto.randomUUID(), payload: review.payload(false) }
  }
  busy.value = true
  try {
    const { data } = await captureApi.import(uuid.value, submission.value.payload, submission.value.key)
    importedCaseId.value = data.caseId
    if (data.alreadyImported) {
      // 다른 요청/탭이 이미 반영 → 중복. 기존 Case 로 안내.
      submitError.value = 'duplicate'
    } else {
      submitError.value = null
      step.value = 'success'
      toast(retry ? `동일 요청을 확인해 Case #${data.caseId}로 연결했어요.` : '새 비공개 Case를 만들었어요.')
    }
  } catch (e) {
    if (isAxiosError(e)) {
      if (!e.response) submitError.value = 'network'
      else if (e.response.status === 409) submitError.value = 'revision'
      else if (e.response.status === 422) toast('검증 정보를 확인해 주세요. 통과로 표시한 검증은 실제 실행·근거가 필요합니다.')
      else toast('반영에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } else {
      submitError.value = 'network'
    }
  } finally {
    busy.value = false
  }
}

async function onLatest() {
  // 최신 revision 을 다시 받아 기준만 올리고 편집은 유지 → 다시 검토 가능.
  try {
    const { data } = await captureApi.detail(uuid.value)
    detail.value = data
    review.rebaseRevision(data.capture.revision)
    latestSeen.value = true
    submitError.value = null
    submission.value = null
    step.value = 'review'
    toast('최신 기준으로 다시 검토해 주세요.')
  } catch {
    toast('최신 원본을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
}
function onExistingCase() {
  if (importedCaseId.value != null) router.push(caseLink(importedCaseId.value))
}
async function nextCapture() {
  try {
    const { data } = await captureApi.reviewQueue()
    const next = data.items.find((c) => c.captureUuid !== uuid.value)
    if (next) router.push({ name: 'captureReview', params: { uuid: next.captureUuid } })
    else backToInbox()
  } catch {
    backToInbox()
  }
}

// ── 폐기 / 복원 ─────────────────────────────────────────────────────────────
async function confirmDiscard() {
  if (busy.value) return
  busy.value = true
  try {
    await captureApi.discard(uuid.value)
    modal.value = null
    toast('기록을 폐기 이력으로 이동했어요.')
    router.push({ name: 'captureInbox', query: { tab: 'history' } })
  } catch (e) {
    if (isAxiosError(e) && e.response?.status === 409) toast('이미 반영된 기록은 폐기할 수 없어요.')
    else toast('폐기에 실패했어요. 다시 시도해 주세요.')
  } finally {
    busy.value = false
  }
}
async function onRestore() {
  if (busy.value) return
  busy.value = true
  try {
    const { data } = await captureApi.restore(uuid.value)
    toast(data.status === 'OPEN' ? '기록 진행 상태로 복원했어요.' : '검토 대기함으로 복원했어요.')
    await load(uuid.value)
  } catch {
    toast('복원에 실패했어요. 다시 시도해 주세요.')
  } finally {
    busy.value = false
  }
}

// ── 편집 모달 ───────────────────────────────────────────────────────────────
const modal = ref<ModalKind>(null)
const ctxForm = reactive({ title: '', body: '' })
const stepForm = reactive({ id: '', title: '', body: '' })
const solForm = reactive({
  id: '', title: '', description: '', clearVerification: false,
  result: 'NOT_RUN' as VerificationResult, scope: '' as VerificationScope | '',
  executed: false, command: '', testId: '', ranAt: '', commitSha: '', evidence: '',
  errors: [] as string[],
})
const fileInfo = ref<CaptureArtifact | null>(null)

function openEditContext() {
  ctxForm.title = review.draft.title
  ctxForm.body = review.draft.body
  modal.value = 'edit-context'
}
function saveContext() {
  if (!ctxForm.title.trim()) {
    toast('제목을 입력해 주세요.')
    return
  }
  review.draft.title = ctxForm.title.trim()
  review.draft.body = ctxForm.body
  review.draft.dirty = true
  modal.value = null
}
function resetContext() {
  if (!detail.value) return
  review.draft.title = detail.value.capture.title ?? ''
  review.draft.body = defaultBody(detail.value.capture.content)
  review.draft.dirty = true
  modal.value = null
}

function openEditStep(id: string) {
  const a = review.attemptById.value.get(id)
  const e = review.draft.stepEdits[id] ?? {}
  stepForm.id = id
  stepForm.title = e.title ?? a?.detail.title ?? ''
  stepForm.body = e.body ?? (a ? stepBody(a) : '')
  modal.value = 'edit-step'
}
function saveStep() {
  if (!stepForm.title.trim()) {
    toast('제목을 입력해 주세요.')
    return
  }
  if (/@(?:attach|snippet)\(/.test(stepForm.body)) {
    toast('첨부 마커를 직접 넣지 말고 근거 파일에서 선택해 주세요.')
    return
  }
  review.draft.stepEdits[stepForm.id] = {
    ...(review.draft.stepEdits[stepForm.id] ?? {}),
    title: stepForm.title.trim(),
    body: stepForm.body,
  }
  review.draft.dirty = true
  modal.value = null
}
function resetStep() {
  delete review.draft.stepEdits[stepForm.id]
  review.draft.dirty = true
  modal.value = null
}

function openEditSolution(id: string) {
  const s = detail.value?.solutions.find((x) => x.clientSolutionId === id)
  if (!s) return
  const v = review.solutionValue(s)
  const ver = v.verification ?? { result: 'NOT_RUN' as VerificationResult, scope: null, executed: false }
  Object.assign(solForm, {
    id,
    title: v.title,
    description: v.description,
    clearVerification: review.draft.solutionEdits[id]?.clearVerification ?? false,
    result: ver.result,
    scope: ver.scope ?? '',
    executed: ver.executed,
    command: ver.command ?? '',
    testId: ver.testId ?? '',
    ranAt: ver.ranAt ?? '',
    commitSha: ver.commitSha ?? '',
    evidence: ver.evidence ?? '',
    errors: [],
  })
  modal.value = 'edit-solution'
}
function saveSolution() {
  const errors: string[] = []
  if (!solForm.title.trim()) errors.push('해결책 제목을 입력해 주세요.')
  if (!solForm.clearVerification && solForm.result === 'PASSED') {
    if (!solForm.executed) errors.push('PASSED로 반영하려면 실제로 실행한 검증이어야 합니다.')
    if (![solForm.command, solForm.testId, solForm.evidence].some((x) => x.trim())) {
      errors.push('실행 명령, 테스트 ID 또는 결과 근거를 입력해 주세요.')
    }
  }
  if (!solForm.clearVerification && solForm.ranAt && Number.isNaN(Date.parse(solForm.ranAt))) {
    errors.push('실행 시각을 ISO 형식으로 입력하거나 비워 주세요.')
  }
  if (errors.length) {
    solForm.errors = errors
    return
  }
  const nn = (s: string) => (s.trim() ? s.trim() : null)
  review.draft.solutionEdits[solForm.id] = {
    title: solForm.title.trim().slice(0, 200),
    description: solForm.description,
    clearVerification: solForm.clearVerification,
    ...(!solForm.clearVerification
      ? {
          verification: {
            result: solForm.result,
            scope: solForm.scope || null,
            command: nn(solForm.command),
            testId: nn(solForm.testId),
            executed: solForm.executed,
            ranAt: nn(solForm.ranAt),
            commitSha: nn(solForm.commitSha),
            evidence: nn(solForm.evidence),
          },
        }
      : {}),
  }
  review.draft.dirty = true
  modal.value = null
  toast('해결책 수정사항을 반영 초안에 적용했어요.')
}
function resetSolution() {
  delete review.draft.solutionEdits[solForm.id]
  review.draft.dirty = true
  modal.value = null
}

function openFileInfo(id: string) {
  fileInfo.value = detail.value?.artifacts.find((f) => f.clientArtifactId === id) ?? null
  modal.value = 'file-info'
}

const requestPreview = computed(() => ({
  key: submission.value?.key ?? '(최종 제출 시 생성)',
  payload: JSON.stringify(submission.value?.payload ?? review.payload(false), null, 2),
}))

const RESULT_OPTIONS: VerificationResult[] = ['NOT_RUN', 'PASSED', 'FAILED', 'INCONCLUSIVE']
const SCOPE_OPTIONS: VerificationScope[] = ['LOCAL', 'CI', 'MANUAL']

function stateTone(): string {
  const s = detail.value?.capture.status
  return s === 'READY_FOR_REVIEW' ? 'green' : s === 'IMPORTED' ? 'blue' : ''
}
</script>

<template>
  <div class="cap page wide">
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
      <button type="button" class="btn small" @click="load(uuid)"><CapIcon name="refresh" />다시 불러오기</button>
    </div>

    <!-- ───────── 반영 완료(success) ───────── -->
    <div v-else-if="detail && isReady && step === 'success'" class="success-panel">
      <div class="success-hero">
        <div class="success-check"><CapIcon name="check" /></div>
        <div class="eyebrow" style="margin-bottom: 10px">REVIEW COMPLETE</div>
        <h1 class="serif">An experience, archived.</h1>
        <p class="muted">검토한 기록을 새 Case로 남겼어요.<br />개인 공간에서 이어서 정리할 수 있습니다.</p>
        <div class="row">
          <router-link v-if="importedCaseId != null" :to="caseLink(importedCaseId)" class="btn primary">Case #{{ importedCaseId }} 보기 <CapIcon name="arrow" /></router-link>
          <button type="button" class="btn" @click="nextCapture">다음 기록 검토</button>
        </div>
      </div>
      <div class="card">
        <div class="row between">
          <h3>{{ review.draft.title }}</h3>
          <span class="badge"><CapIcon name="lock" />Private</span>
        </div>
        <div class="divider" />
        <div class="row wrap">
          <span class="badge">시도 {{ review.draft.attempts.length }}개</span>
          <span class="badge">해결책 {{ review.draft.solutions.length }}개</span>
          <span class="badge">파일 {{ review.draft.artifacts.length }}개</span>
          <span class="badge" :class="review.draft.markResolved ? 'green' : 'blue'">{{ review.draft.markResolved ? 'Resolved' : 'Open' }}</span>
        </div>
      </div>
      <p class="small muted" style="text-align: center; margin-top: 19px">수집 원본은 검토 이력에서 다시 볼 수 있어요.</p>
    </div>

    <!-- ───────── 검토 / 미리보기 편집기 ───────── -->
    <template v-else-if="detail && isReady">
      <button type="button" class="back" @click="step === 'preview' ? backReview() : backToInbox()">
        <CapIcon name="back" />{{ step === 'preview' ? '검토로 돌아가기' : '검토 대기함' }}
      </button>

      <template v-if="step === 'review'">
        <div class="row wrap">
          <span class="badge green">검토 대기</span>
          <span class="badge"><CapIcon name="lock" />나만 볼 수 있음</span>
          <span class="tiny muted">{{ detail.capture.project }} · {{ detail.capture.updatedAt.slice(0, 10) }}</span>
        </div>
        <h1 class="detail-title">{{ review.draft.title }}</h1>
        <p class="small muted">남길 내용을 선택하고, 필요한 부분을 정정해 주세요. 수집된 원본은 그대로 보관됩니다.</p>
        <ReviewStepper step="review" />
        <div class="section-nav">
          <a href="#context">문제 맥락</a><a href="#attempts">시도 기록</a><a href="#solutions">해결책 후보</a><a href="#artifacts">근거 파일</a>
          <span class="grow" />
          <a style="color: var(--muted)" @click="modal = 'discard'">기록 폐기</a>
        </div>
        <div class="review-layout">
          <div class="review-content">
            <ContextCard :review="review" :detail="detail" @edit="openEditContext" @original="modal = 'original'" />
            <AttemptTimeline :review="review" :detail="detail" @edit-step="openEditStep" />
            <SolutionList :review="review" :detail="detail" @edit-solution="openEditSolution" />
            <ArtifactList :review="review" :detail="detail" @file-info="openFileInfo" />
          </div>
          <ReviewSummary
            :review="review" step="review" :busy="busy" :submit-error="submitError"
            :has-submission="!!submission" :latest-seen="latestSeen"
            @preview="goPreview" @go-queue="backToInbox" @request="modal = 'request'"
            @latest="onLatest" @retry-import="doImport(true)" @existing-case="onExistingCase"
          />
        </div>
      </template>

      <template v-else>
        <div class="eyebrow">FINAL REVIEW</div>
        <h1 class="serif page-title">Make it yours.</h1>
        <p class="subtitle">이 내용으로 개인 비공개 Case를 만듭니다.</p>
        <ReviewStepper step="preview" />
        <div class="review-layout">
          <div class="review-content">
            <PreviewContent :review="review" :detail="detail" />
          </div>
          <ReviewSummary
            :review="review" step="preview" :busy="busy" :submit-error="submitError"
            :has-submission="!!submission" :latest-seen="latestSeen"
            @import="doImport()" @back-review="backReview" @request="modal = 'request'"
            @latest="onLatest" @retry-import="doImport(true)" @existing-case="onExistingCase"
          />
        </div>
      </template>
    </template>

    <!-- ───────── 읽기 뷰(반영 완료·폐기·기록 중) ───────── -->
    <template v-else-if="detail">
      <button type="button" class="back" @click="router.push({ name: 'captureInbox', query: { tab: 'history' } })"><CapIcon name="back" />검토 이력</button>
      <div class="row wrap">
        <span class="badge" :class="stateTone()">{{ CAPTURE_STATE_LABELS[detail.capture.status] }}</span>
        <span class="tiny muted">{{ detail.capture.project }}</span>
      </div>
      <h1 class="detail-title">{{ detail.capture.title || '(제목 없음)' }}</h1>

      <div class="notice neutral" style="margin: 20px 0">
        <template v-if="detail.capture.status === 'IMPORTED'">반영을 마친 수집 원본입니다. 이후 수정은 생성된 Case에서 진행해 주세요.</template>
        <template v-else-if="detail.capture.status === 'OPEN'">기록 진행 상태입니다. AI가 기록을 마치면 검토함에 표시됩니다.</template>
        <template v-else>폐기한 원본 기록을 보관하고 있습니다. 복원하면 폐기 전 단계로 돌아갑니다.</template>
      </div>
      <div v-if="detail.capture.status === 'DISCARDED'" class="row" style="margin-bottom: 25px">
        <button type="button" class="btn primary" :disabled="busy" @click="onRestore">기록 복원</button>
      </div>

      <div class="card"><MarkdownBody :content="defaultBody(detail.capture.content)" /></div>

      <section class="section" style="margin-top: 25px">
        <h3 style="margin-bottom: 15px">수집된 시도 {{ detail.attempts.length }}건</h3>
        <div v-for="a in detail.attempts" :key="a.clientAttemptId" class="card" style="margin-bottom: 12px">
          <div class="row between"><h3>{{ a.detail.title }}</h3><span class="badge">{{ ATTEMPT_RESULT_LABELS[a.result] }}</span></div>
          <MarkdownBody v-if="stepBody(a)" :content="stepBody(a)" style="margin-top: 10px" />
          <div v-if="a.detail.insight" class="insight"><strong>Insight</strong> · {{ a.detail.insight }}</div>
        </div>
      </section>
      <section class="section" style="margin-top: 25px">
        <h3 style="margin-bottom: 15px">수집된 해결책 {{ detail.solutions.length }}건</h3>
        <div v-for="s in detail.solutions" :key="s.clientSolutionId" class="card" style="margin-bottom: 12px">
          <h3>{{ s.title }}</h3>
          <p v-if="s.content.description" class="small muted" style="margin: 12px 0">{{ s.content.description }}</p>
          <VerifyBlock :verification="s.content.verification" />
        </div>
      </section>
    </template>

    <!-- ───────── 모달 ───────── -->
    <CapModal :show="modal === 'edit-context'" title="Case에 반영할 내용 수정" large @close="modal = null">
      <label class="form-field"><span>제목</span><input v-model="ctxForm.title" class="cap-input" maxlength="200" /></label>
      <label class="form-field"><span>본문 (Markdown)</span><textarea v-model="ctxForm.body" class="cap-input" rows="14" /></label>
      <p class="tiny muted">수집 원본은 보존됩니다. 이 내용은 최종 Case 본문에 적용됩니다.</p>
      <template #footer>
        <button type="button" class="btn ghost" @click="resetContext">원본으로 되돌리기</button>
        <button type="button" class="btn" @click="modal = null">취소</button>
        <button type="button" class="btn primary" @click="saveContext">검토에 적용</button>
      </template>
    </CapModal>

    <CapModal :show="modal === 'edit-step'" title="시도 기록 수정" large @close="modal = null">
      <label class="form-field"><span>Step 제목</span><input v-model="stepForm.title" class="cap-input" maxlength="200" /></label>
      <label class="form-field"><span>Step 본문 (Markdown)</span><textarea v-model="stepForm.body" class="cap-input" rows="8" /></label>
      <p class="tiny muted">Insight는 별도 정보로 이관됩니다. 첨부는 파일 선택 영역에서 포함 여부를 바꿔주세요.</p>
      <template #footer>
        <button type="button" class="btn ghost" @click="resetStep">원본으로 되돌리기</button>
        <button type="button" class="btn" @click="modal = null">취소</button>
        <button type="button" class="btn primary" @click="saveStep">검토에 적용</button>
      </template>
    </CapModal>

    <CapModal :show="modal === 'edit-solution'" title="해결책과 검증 정보 수정" large @close="modal = null">
      <label class="form-field"><span>해결책 제목</span><input v-model="solForm.title" class="cap-input" /></label>
      <label class="form-field"><span>상세 설명</span><textarea v-model="solForm.description" class="cap-input" rows="3" /></label>
      <label class="choice"><input v-model="solForm.clearVerification" class="check" type="checkbox" /><span>검증 정보를 제외하고 반영</span></label>
      <div :style="solForm.clearVerification ? 'opacity: .4; pointer-events: none' : ''">
        <div class="form-grid">
          <label class="form-field"><span>검증 결과</span>
            <select v-model="solForm.result" class="cap-input"><option v-for="r in RESULT_OPTIONS" :key="r" :value="r">{{ r }}</option></select>
          </label>
          <label class="form-field"><span>검증 범위</span>
            <select v-model="solForm.scope" class="cap-input"><option value="">미지정</option><option v-for="s in SCOPE_OPTIONS" :key="s" :value="s">{{ s }}</option></select>
          </label>
        </div>
        <label class="choice"><input v-model="solForm.executed" class="check" type="checkbox" /><span>실제로 실행한 검증이에요</span></label>
        <label class="form-field"><span>실행 명령</span><input v-model="solForm.command" class="cap-input" /></label>
        <label class="form-field"><span>테스트 ID</span><input v-model="solForm.testId" class="cap-input" /></label>
        <div class="form-grid">
          <label class="form-field"><span>실행 시각 (ISO 형식, 선택)</span><input v-model="solForm.ranAt" class="cap-input" /></label>
          <label class="form-field"><span>Commit SHA (선택)</span><input v-model="solForm.commitSha" class="cap-input" /></label>
        </div>
        <label class="form-field"><span>실행 결과·근거</span><textarea v-model="solForm.evidence" class="cap-input" rows="3" /></label>
      </div>
      <p class="tiny muted">PASSED는 실제 실행 여부와 명령·테스트 ID·결과 근거 중 하나가 필요합니다.</p>
      <div v-if="solForm.errors.length" class="error-list" role="alert"><p v-for="(e, i) in solForm.errors" :key="i">{{ e }}</p></div>
      <template #footer>
        <button type="button" class="btn ghost" @click="resetSolution">원본으로 되돌리기</button>
        <button type="button" class="btn" @click="modal = null">취소</button>
        <button type="button" class="btn primary" @click="saveSolution">검토에 적용</button>
      </template>
    </CapModal>

    <CapModal :show="modal === 'file-info'" title="근거 파일 정보" @close="modal = null">
      <div v-if="fileInfo" class="row">
        <div class="file-icon"><CapIcon name="file" /></div>
        <div><h3>{{ fileInfo.fileName || fileInfo.clientArtifactId }}</h3><span class="tiny muted">{{ fileInfo.contentType }} · {{ fileInfo.sizeBytes.toLocaleString() }} bytes</span></div>
      </div>
      <div class="divider" />
      <p class="tiny muted">SHA-256</p>
      <p class="mono tiny" style="overflow-wrap: anywhere">{{ fileInfo?.sha256 }}</p>
      <div class="notice neutral" style="margin-top: 20px">업로드 완료 상태의 파일입니다. 현재 검토 API는 파일 메타데이터만 반환하므로 이 화면에서 내용을 열거나 내려받을 수는 없어요.</div>
      <template #footer><button type="button" class="btn primary" @click="modal = null">확인</button></template>
    </CapModal>

    <CapModal :show="modal === 'original'" title="수집된 원본" large @close="modal = null">
      <h3 v-if="detail">{{ detail.capture.title }}</h3>
      <div v-if="detail" class="preview-body"><MarkdownBody :content="defaultBody(detail.capture.content)" /></div>
      <template #footer><button type="button" class="btn primary" @click="modal = null">닫기</button></template>
    </CapModal>

    <CapModal :show="modal === 'request'" title="Import 요청 미리보기" large @close="modal = null">
      <p class="small muted">사용자 세션으로 POST /api/v1/captures/{uuid}/import</p>
      <pre class="api-pre">Idempotency-Key: {{ requestPreview.key }}

{{ requestPreview.payload }}</pre>
      <template #footer><button type="button" class="btn primary" @click="modal = null">닫기</button></template>
    </CapModal>

    <CapModal :show="modal === 'discard'" title="이 기록을 폐기할까요?" @close="modal = null">
      <p class="subtitle">{{ detail?.capture.title }}</p>
      <div class="notice neutral" style="margin-top: 18px">검토 대기함에서 제외되고 폐기 이력에 보관됩니다. 필요하면 원본을 복원할 수 있어요. 검토 중 편집한 값은 반영되지 않습니다.</div>
      <template #footer>
        <button type="button" class="btn" @click="modal = null">계속 검토</button>
        <button type="button" class="btn danger" :disabled="busy" @click="confirmDiscard">기록 폐기</button>
      </template>
    </CapModal>
  </div>
</template>
