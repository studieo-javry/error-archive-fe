<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { errorApi } from '@/services/errorApi'
import { snippetApi } from '@/services/snippetApi'
import { attachmentApi } from '@/services/attachmentApi'
import { teamApi } from '@/services/teamApi'
import { useTeamStore } from '@/stores/teamStore'
import { useAuthStore } from '@/stores/authStore'
import { useDemoStore } from '@/stores/demoStore'
import { useTourStore } from '@/stores/tourStore'
import type { Visibility, SnippetCreateRequest, SnippetCreateResponse, AttachmentUploadResponse, ErrorCaseSnippet, ErrorCaseAttachment, MyPendingAttachment, MyPendingSnippet, SimilarCaseItem, DraftSuggestionResponse } from '@/types/error'
import type { WorkspaceListItem } from '@/types/team'
import BodyRenderer from '@/components/common/BodyRenderer.vue'
import SnippetModal from '@/components/snippet/SnippetModal.vue'
import SnippetCard from '@/components/snippet/SnippetCard.vue'
import AttachmentModal from '@/components/attachment/AttachmentModal.vue'
import AttachmentCard from '@/components/attachment/AttachmentCard.vue'
import DemoNotice from '@/components/demo/DemoNotice.vue'
import SimilarCasesPanel from '@/components/error/SimilarCasesPanel.vue'
import { useSimilarCases } from '@/composables/useSimilarCases'
import { CodeBracketIcon, PaperClipIcon, ClockIcon } from '@heroicons/vue/24/outline'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const router = useRouter()
const teamStore = useTeamStore()
const authStore = useAuthStore()
const demo = useDemoStore()
const tourStore = useTourStore()
const { startSignup } = useAuth()
const isEdit = !!route.params.id
const caseId = route.params.id ? Number(route.params.id) : undefined

const title = ref('')
const scope = ref('')
const paste = ref('')
const description = ref('')
const visibility = ref<Visibility>('PRIVATE')
const tags = ref<string[]>([])
const tagInput = ref('')
const workspaces = ref<WorkspaceListItem[]>([])
const workspaceId = ref<number | null>(null)
// severity(1..4, submit 포함) · exceptionClass(원문 추출 표시용, 저장 X). 항상 노출(AI 안 써도 수동 지정 가능).
const severity = ref<number | null>(null)
const exceptionClass = ref('')

// 유사 에러 추천 — 제목 입력 중 비슷한 기존 사례를 옆에 실시간 노출.
// 지금은 데모(게스트) 전용 트라이얼로만 노출(정식 도입 시 게이트 확대). 신규 작성 시만.
// 데모 게스트는 데모 워크스페이스 멤버라, 현재 WS 스코프로 시드 사례가 검색된다.
const showSimilar = computed(() => authStore.isGuest && !isEdit)
const { items: similarItems, loading: similarLoading } = useSimilarCases(
  title,
  computed(() => teamStore.currentWorkspaceId),
  { enabled: showSimilar },
)

// 가이드 인트로 '비슷한 사례 띄워보기': 예시 제목을 끊김 없이 45ms/글자로 타이핑하면서,
// 데모 동안엔 매 글자 추천을 '클라이언트에서' 즉시 계산해(demoPreview) 패널을 부드럽게 채운다
// — 서버 디바운스 호출 없이 PJWW 목업처럼 퍼센트가 흐르고 러너업이 하나씩 늘어난다.
// 사용자가 '직접' 입력하면(@input) demoPreview 를 비워 실제 서버 검색(useSimilarCases) 결과로 넘어간다.
const titleInput = ref<HTMLInputElement | null>(null)
const DEMO_TITLE = 'NullPointerException in OrderService'
const demoPreview = ref<SimilarCaseItem[] | null>(null)
const demoTyping = ref(false)
// 패널은 데모 중엔 클라 프리뷰를, 그 외엔 실제 서버 결과를 쓴다.
const panelItems = computed<SimilarCaseItem[]>(() => demoPreview.value ?? similarItems.value)
const panelLoading = computed(() => demoTyping.value || similarLoading.value)

// 데모 시연용 고정 사례(오프라인 목/실 BE 와 동일) — 입력 진행도에 따라 점수·노출을 계산.
const DEMO_DATA = [
  { id: 1, ownerUserId: 1, title: 'NullPointerException in OrderService.calculateTotal', status: 'RESOLVED', visibility: 'WORKSPACE', workspaceId: 1, tags: ['kotlin', 'npe'], descriptionPreview: '쿠폰이 null 인 주문에서 금액 합산 시 NPE. Elvis 로 기본값 처리 + 회귀 테스트.', matchedTerms: ['nullpointerexception', 'orderservice'], finalScore: 0.93, appearAt: 0 },
  { id: 6, ownerUserId: 3, title: '주문 금액 합산 중 NullPointerException 재발 — 배송비 null', status: 'RESOLVED', visibility: 'WORKSPACE', workspaceId: 1, tags: ['kotlin', 'npe'], descriptionPreview: '배송비 없는 디지털 상품 주문에서 재발. 합산 입력 전체를 nullable 로 정리.', matchedTerms: ['nullpointerexception'], finalScore: 0.71, appearAt: 0.45 },
  { id: 3, ownerUserId: 4, title: 'HikariCP 커넥션 풀 고갈로 간헐적 503', status: 'IN_PROGRESS', visibility: 'WORKSPACE', workspaceId: 1, tags: ['hikaricp', '503'], descriptionPreview: '피크 트래픽에 pool(10) 고갈 → getConnection 타임아웃.', matchedTerms: [], finalScore: 0.38, appearAt: 0.72 },
]
function demoItemsFor(prog: number): SimilarCaseItem[] {
  return DEMO_DATA.filter((d) => prog >= d.appearAt).map((d) => {
    const score = Math.round(Math.max(0.2, d.finalScore * (0.5 + 0.5 * prog)) * 100) / 100
    const { finalScore: _f, appearAt: _a, ...rest } = d
    return { ...rest, score, likelyDuplicate: d.id === 1 && score >= 0.85 } as SimilarCaseItem
  })
}

let demoTypeTimer: ReturnType<typeof setInterval> | null = null
function stopDemoTyping() {
  if (demoTypeTimer) { clearInterval(demoTypeTimer); demoTypeTimer = null }
  demoTyping.value = false
}
watch(() => tourStore.similarDemoRequest, () => {
  if (!showSimilar.value) return
  stopDemoTyping()
  title.value = ''
  demoPreview.value = []
  demoTyping.value = true
  let i = 0
  demoTypeTimer = setInterval(() => {
    title.value = DEMO_TITLE.slice(0, ++i)
    const prog = i / DEMO_TITLE.length
    demoPreview.value = title.value.trim().length >= 2 ? demoItemsFor(prog) : []
    if (i >= DEMO_TITLE.length) stopDemoTyping()
  }, 45)
})
watch(() => tourStore.similarManualRequest, () => {
  if (!showSimilar.value) return
  stopDemoTyping()
  demoPreview.value = null
  title.value = ''
  nextTick(() => titleInput.value?.focus())
})

// AI 가이드 단계(step 1): 데모 박스 문구 전환 + 가이드 카드의 '샘플 띄워보기'/'내 로그 분석' 신호 수신.
// 샘플 결과 박스가 하이라이트되는 순간(= aiTried)부터 데모박스 문구를 AI 안내로 전환.
const onAiTourStep = computed(() => authStore.isGuest && tourStore.status === 'active' && tourStore.step === 1 && tourStore.flags.aiTried)
watch(() => tourStore.aiDemoRequest, () => {
  if (!authStore.isGuest) return
  showGuestSample.value = true
  scrollToAiSlot()
})
watch(() => tourStore.aiGateRequest, () => {
  if (!authStore.isGuest) return
  showGuestSample.value = false
  showAiGuestModal.value = true
})
// 사용자가 직접 입력하면 데모 프리뷰를 끄고 실제 검색으로. (데모의 programmatic 입력은 @input 을 발생시키지 않음)
function onTitleInput() {
  stopDemoTyping()
  demoPreview.value = null
}
onBeforeUnmount(stopDemoTyping)

watch(visibility, async (val) => {
  if (val === 'WORKSPACE' && !workspaces.value.length) {
    const res = await teamApi.listWorkspaces()
    workspaces.value = res.data
  }
})

function addTag(e: Event) {
  e.preventDefault()
  const val = tagInput.value.trim()
  if (val && !tags.value.includes(val)) {
    tags.value.push(val)
    onEditField('tags')
  }
  tagInput.value = ''
}

function removeTag(tag: string) {
  tags.value = tags.value.filter(t => t !== tag)
  onEditField('tags')
}

const snippetMarkers = ref<SnippetCreateResponse[]>([])
const attachmentMarkers = ref<AttachmentUploadResponse[]>([])
const showSnippetModal = ref(false)
const showAttachmentModal = ref(false)

const descriptionRef = ref<HTMLTextAreaElement | null>(null)
const previewMode = ref(false)

// Adapt the form's in-progress markers to the shapes BodyRenderer expects.
const previewSnippets = computed<ErrorCaseSnippet[]>(() =>
  snippetMarkers.value.map(s => ({
    markerId: s.markerId,
    title: s.title ?? '',
    language: s.language,
    filePathOrClass: null,
    lineRange: null,
    caption: s.caption ?? null,
    code: s.code ?? '',
  })),
)
const previewAttachments = computed<ErrorCaseAttachment[]>(() =>
  attachmentMarkers.value.map(a => ({
    markerId: a.markerId,
    fileName: a.fileName,
    contentType: a.contentType,
    size: a.size,
    kind: a.kind,
    storageUrl: a.storageUrl,
    title: null,
    caption: null,
  })),
)

// Drag-resize in the preview rewrites the image marker's width: @attach(id|width).
function onImageResize(markerId: string, width: number) {
  const re = new RegExp(`@attach\\(${markerId}(?:\\|\\d+)?\\)`, 'g')
  description.value = description.value.replace(re, `@attach(${markerId}|${width})`)
}

function insertAtCursor(marker: string) {
  const el = descriptionRef.value
  if (!el) {
    description.value += `\n${marker}`
    return
  }
  const start = el.selectionStart
  const end = el.selectionEnd
  const before = description.value.slice(0, start)
  const after = description.value.slice(end)
  description.value = before + marker + after
  nextTick(() => {
    el.selectionStart = el.selectionEnd = start + marker.length
    el.focus()
  })
}

async function loadError() {
  if (!isEdit || !caseId) return
  const { data } = await errorApi.get(caseId)
  title.value = data.title
  scope.value = data.project ?? ''
  paste.value = data.snapshot?.rawPaste ?? ''
  description.value = data.description ?? ''
  visibility.value = data.visibility as Visibility
  tags.value = data.tags ?? []
  severity.value = data.severity ?? null
  exceptionClass.value = data.snapshot?.exceptionClass ?? ''
  if (data.workspaceId) {
    workspaceId.value = data.workspaceId
    const wsRes = await teamApi.listWorkspaces()
    workspaces.value = wsRes.data
  }

  snippetMarkers.value = data.snippets.map(s => ({
    markerId: s.markerId,
    embedToken: '',
    title: s.title,
    language: s.language,
    caption: s.caption,
    code: s.code,
  }))
  attachmentMarkers.value = data.attachments.map(a => ({
    markerId: a.markerId,
    embedToken: '',
    fileName: a.fileName,
    contentType: a.contentType,
    size: a.size,
    kind: a.kind,
    storageUrl: a.storageUrl,
  }))
}

// ════════ AI로 채우기 (POST /error-cases/draft-suggestion) ════════
// "사실은 정규식·해석은 LLM" 서버 결과를 미리보기로 받아 사용자가 항목을 골라 폼에 적용(자동 저장 X).
const SEVERITY_META: Record<number, { name: string; label: string; color: string }> = {
  1: { name: 'S1', label: 'Outage', color: '#f43f5e' },
  2: { name: 'S2', label: 'Degraded', color: '#f59e0b' },
  3: { name: 'S3', label: 'Minor', color: '#3b82f6' },
  4: { name: 'S4', label: 'Info', color: '#71717a' },
}

// 게스트(데모) 체험용 고정 샘플 — 게스트는 "샘플 결과 보기"로 미리 준비된 예시 제안을 읽기 전용으로
// 체험만 할 수 있다(입력 원문을 분석하지 않음·폼에 적용 안 됨). 내 로그 분석/적용은 로그인 필요.
interface DemoSample { id: string; tabLabel: string; label: string; detail: string; raw: string; result: DraftSuggestionResponse }
const DEMO_SAMPLES: DemoSample[] = [
  {
    id: 'java', tabLabel: 'Java · NPE', label: 'Java · 주문 금액 계산', detail: 'NullPointerException / coupon is null',
    raw: 'java.lang.NullPointerException: coupon is null\n\tat com.shop.OrderService.calculateTotal(OrderService.java:42)\n\tat com.shop.OrderController.create(OrderController.java:17)',
    result: {
      title: '주문 합계 계산 중 NullPointerException',
      exceptionClass: 'java.lang.NullPointerException',
      summary: 'OrderService.calculateTotal에서 coupon이 null인 상태로 사용되어 주문 합계 계산에 실패했습니다.',
      tags: ['nullpointerexception', 'java', 'order', 'orderservice'],
      severity: { name: 'S2', code: 2, label: 'Degraded' },
      degraded: false,
    },
  },
  {
    id: 'pool', tabLabel: 'Java · DB 타임아웃', label: 'Java · DB 커넥션 타임아웃', detail: 'HikariCP / SQLTransientConnectionException',
    raw: '2026-10-27 14:32:18 ERROR [http-nio-8080-exec-7] c.shop.OrderRepository\njava.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available, request timed out after 30000ms.\n\tat com.zaxxer.hikari.pool.HikariPool.createTimeoutException(HikariPool.java:696)\n\tat com.zaxxer.hikari.pool.HikariPool.getConnection(HikariPool.java:197)\n\tat com.shop.OrderRepository.findById(OrderRepository.java:58)',
    result: {
      title: 'HikariCP 커넥션 획득 타임아웃',
      exceptionClass: 'java.sql.SQLTransientConnectionException',
      summary: 'HikariPool-1에서 30초 동안 사용 가능한 DB 커넥션을 얻지 못해 OrderRepository의 주문 조회가 실패했습니다.',
      tags: ['java', 'hikaricp', 'database', 'timeout'],
      severity: { name: 'S2', code: 2, label: 'Degraded' },
      degraded: false,
    },
  },
  {
    id: 'js', tabLabel: 'React · TypeError', label: 'JavaScript · 목록 렌더링', detail: 'TypeError / Cannot read properties of undefined',
    raw: "TypeError: Cannot read properties of undefined (reading 'map')\n    at ProductList (src/components/ProductList.tsx:28:19)\n    at renderWithHooks (react-dom.development.js:15486:18)",
    result: {
      title: '상품 목록 렌더링 중 TypeError',
      exceptionClass: 'TypeError',
      summary: 'ProductList에서 undefined 값에 map을 호출해 상품 목록을 렌더링하지 못했습니다.',
      tags: ['javascript', 'react', 'typeerror', 'rendering'],
      severity: { name: 'S3', code: 3, label: 'Minor' },
      degraded: false,
    },
  },
]
const guestSampleId = ref('java')
const showGuestSample = ref(false)
const guestSample = computed(() => DEMO_SAMPLES.find((s) => s.id === guestSampleId.value) ?? DEMO_SAMPLES[0])

const aiBusy = ref(false)
const aiProgress = ref('')
const aiError = ref(false)
const aiResult = ref<DraftSuggestionResponse | null>(null)
const aiSelected = ref<Record<string, boolean>>({})
const aiEdited = ref<Record<string, boolean>>({})
const showAiMeta = ref(true) // Exception/Severity 는 항상 노출(AI 적용과 무관)
const appliedKeys = ref<Set<string>>(new Set())
const aiApplied = ref(false)
const aiAppliedCopy = ref('')
const aiAppliedHint = ref('')
const aiAppliedEditKeys = ref<string[]>([])
const aiFlash = ref<Set<string>>(new Set())
let aiJob = 0
let aiUndo: { changes: { key: string; before: unknown; after: unknown }[]; previousMeta: boolean } | null = null
const aiUndoAvailable = ref(false)

// 게스트가 "AI로 채우기" 시도 → 로그인 안내 모달(BE 403, 로그인 사용자 전용).
const showAiGuestModal = ref(false)
function closeAiGuestModal() { showAiGuestModal.value = false }

// "작성 내용은 유지돼요" — 로그인(OAuth) 이탈 전 초안을 저장하고, New Entry 재진입 시 복원.
const DRAFT_KEY = 'errorDraft:new'
function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      title: title.value, project: scope.value, paste: paste.value,
      description: description.value, tags: tags.value, severity: severity.value,
      visibility: visibility.value, exceptionClass: exceptionClass.value,
    }))
  } catch { /* localStorage 불가 환경 무시 */ }
}
function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return
    localStorage.removeItem(DRAFT_KEY)
    const d = JSON.parse(raw)
    if (d.title) title.value = d.title
    if (d.project) scope.value = d.project
    if (d.paste) paste.value = d.paste
    if (d.description) description.value = d.description
    if (Array.isArray(d.tags) && d.tags.length) tags.value = d.tags
    if (d.severity != null) severity.value = d.severity
    if (d.visibility) visibility.value = d.visibility
    if (d.exceptionClass) exceptionClass.value = d.exceptionClass
  } catch { /* 손상된 초안 무시 */ }
}
function goSignupFromAi() {
  saveDraft()
  try { sessionStorage.setItem('oauth_return_url', route.fullPath) } catch { /* ignore */ }
  showAiGuestModal.value = false
  startSignup()
}

const traceCount = computed(() => paste.value.length)
// 게스트는 원문 없이도 "샘플 결과 보기"가 가능 → 비활성 아님. 회원은 원문/분석중일 때 비활성.
const aiDisabled = computed(() => aiBusy.value || (!authStore.isGuest && !paste.value.trim()))
const aiButtonLabel = computed(() => {
  if (authStore.isGuest) return '샘플 결과 보기'
  if (aiBusy.value) return '분석 중…'
  return (aiResult.value || aiApplied.value) ? '다시 분석' : 'AI로 채우기'
})
// 게스트의 "내 로그 분석"/"내 로그로 AI 분석하기"·제안 적용 → 회원 전용. 로그인 안내 게이트.
function requestMemberAuth() { showGuestSample.value = false; showAiGuestModal.value = true }

// 미리보기/적용 결과로 부드럽게 스크롤(목업 동작).
const smoothIfAllowed = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' as const : 'smooth' as const)
function scrollToAiSlot() {
  nextTick(() => document.getElementById('ai-slot')?.scrollIntoView({ behavior: smoothIfAllowed(), block: 'nearest' }))
}
function scrollToApplied() {
  requestAnimationFrame(() => document.getElementById('ai-applied-note')?.scrollIntoView({ behavior: smoothIfAllowed(), block: 'center' }))
}

// "다른 예제 불러오기" — 샘플 원문을 트레이스에 로드(목업 sampleModal). 게스트(데모) 전용.
const showSamplePicker = ref(false)
function openSamplePicker() { showSamplePicker.value = true }
function loadSample(s: DemoSample) {
  invalidateAi()
  paste.value = s.raw
  showSamplePicker.value = false
  demo.toast('예제 원문을 불러왔어요. 「샘플 결과 보기」는 별도의 미리 준비된 예시를 보여줘요.')
}
function clearTrace() { invalidateAi(); paste.value = ''; showSamplePicker.value = false }
const editFieldLabels: Record<string, string> = { title: '제목', summary: '설명', tags: '태그', severity: '심각도' }

function getAiField(key: string): unknown {
  if (key === 'title') return title.value
  if (key === 'summary') return description.value
  if (key === 'tags') return [...tags.value]
  if (key === 'severity') return severity.value
  if (key === 'exceptionClass') return exceptionClass.value
  return ''
}
function eqAi(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b) }
function sevColor(code: number | null) { return code != null ? SEVERITY_META[code].color : '#71717a' }

interface AiRow { key: string; label: string; available: boolean; exists: boolean; display: string; isTags: boolean; tags: string[]; isSeverity: boolean; sevCode: number | null; sourceLabel: boolean }
const aiRows = computed<AiRow[]>(() => {
  const r = aiResult.value
  if (!r) return []
  const sev = r.severity?.code ?? null
  return [
    { key: 'title', label: '제목', available: !!r.title, exists: !!title.value.trim(), display: r.title ?? '', isTags: false, tags: [], isSeverity: false, sevCode: null, sourceLabel: false },
    { key: 'exceptionClass', label: '예외', available: !!r.exceptionClass, exists: !!exceptionClass.value, display: r.exceptionClass ?? '', isTags: false, tags: [], isSeverity: false, sevCode: null, sourceLabel: true },
    { key: 'summary', label: '요약', available: !!r.summary, exists: !!description.value.trim(), display: r.summary ?? '', isTags: false, tags: [], isSeverity: false, sevCode: null, sourceLabel: false },
    { key: 'tags', label: '태그', available: r.tags.length > 0, exists: tags.value.length > 0, display: '', isTags: true, tags: r.tags, isSeverity: false, sevCode: null, sourceLabel: false },
    { key: 'severity', label: '심각도', available: sev != null, exists: severity.value != null, display: sev != null ? `${SEVERITY_META[sev].name} · ${SEVERITY_META[sev].label}` : '', isTags: false, tags: [], isSeverity: true, sevCode: sev, sourceLabel: false },
  ]
})
const aiSelectedCount = computed(() => aiRows.value.filter(r => r.available && aiSelected.value[r.key]).length)
function aiKeepNote(row: AiRow): string {
  if (!row.exists || !row.available || row.key === 'exceptionClass') return ''
  if (aiEdited.value[row.key]) return '새로 작성한 내용 있음 · 선택하면 교체'
  if (row.key === 'tags') return '기존 태그에 중복 없이 추가'
  return eqAi(getAiField(row.key), row.key === 'severity' ? row.sevCode : row.display) ? '이미 같은 내용이 있어요.' : '작성한 내용 있음 · 선택하면 교체'
}

function invalidateAi() {
  aiJob++
  aiBusy.value = false
  aiError.value = false
  aiProgress.value = ''
  aiResult.value = null
}

async function analyzeDraft() {
  // 게스트: 입력 원문을 분석하지 않고, 미리 준비된 "샘플 결과"만 읽기 전용으로 체험.
  if (authStore.isGuest) { showGuestSample.value = true; scrollToAiSlot(); return }

  if (aiBusy.value) return
  const raw = paste.value.trim()
  if (!raw) { demo.toast('분석할 에러 원문을 먼저 입력해 주세요.'); return }

  aiJob++
  const job = aiJob
  aiBusy.value = true
  aiError.value = false
  aiResult.value = null
  aiProgress.value = '에러 원문을 살펴보고 있어요'
  setTimeout(() => { if (job === aiJob && aiBusy.value) aiProgress.value = '제목과 설명에 넣을 제안을 정리하고 있어요' }, 500)

  try {
    const { data } = await errorApi.draftSuggestion({ paste: raw, workspaceTags: tags.value })
    if (job !== aiJob) return
    aiBusy.value = false
    aiResult.value = data
    if (data.exceptionClass) exceptionClass.value = data.exceptionClass
    const sel: Record<string, boolean> = {}
    for (const row of aiRows.value) sel[row.key] = row.available && (!row.exists || row.key === 'tags' || row.key === 'exceptionClass')
    aiSelected.value = sel
    aiEdited.value = {}
    scrollToAiSlot()
  } catch {
    if (job !== aiJob) return
    aiBusy.value = false
    aiError.value = true
  }
}
function cancelAnalyze() { invalidateAi(); demo.toast('분석을 취소했어요.') }
function dismissPreview() { aiResult.value = null }

function flashField(key: string) {
  aiFlash.value = new Set(aiFlash.value).add(key)
  setTimeout(() => { const s = new Set(aiFlash.value); s.delete(key); aiFlash.value = s }, 1200)
}

function applyDraft() {
  const r = aiResult.value
  if (!r) return
  const selected = aiRows.value.filter(row => row.available && aiSelected.value[row.key]).map(row => row.key)
  if (!selected.length) return
  const changes: { key: string; before: unknown; after: unknown }[] = []
  for (const key of selected) {
    const before = getAiField(key)
    let after: unknown
    if (key === 'tags') after = [...new Set([...tags.value, ...r.tags])]
    else if (key === 'summary') after = r.summary ?? ''
    else if (key === 'title') after = r.title ?? ''
    else if (key === 'severity') after = r.severity?.code ?? null
    else after = r.exceptionClass ?? ''
    if (eqAi(before, after)) continue
    changes.push({ key, before, after })
    if (key === 'tags') tags.value = after as string[]
    else if (key === 'summary') description.value = after as string
    else if (key === 'title') title.value = after as string
    else if (key === 'severity') severity.value = after as number | null
    else exceptionClass.value = after as string
    if (!r.degraded && key !== 'exceptionClass') appliedKeys.value.add(key)
    flashField(key)
  }
  aiUndo = { changes, previousMeta: !showAiMeta.value }
  aiUndoAvailable.value = changes.length > 0
  aiResult.value = null
  showAiMeta.value = true
  aiApplied.value = true
  aiAppliedCopy.value = changes.length ? `${changes.length}개 항목을 폼에 적용했어요.` : '선택한 내용이 이미 폼에 입력되어 있어요.'
  aiAppliedHint.value = changes.some(c => editFieldLabels[c.key])
    ? '아직 저장되지 않았어요. 아래 입력란에서 자유롭게 수정할 수 있어요.'
    : '예외 클래스는 원문에서 추출한 읽기 전용 정보예요.'
  aiAppliedEditKeys.value = selected.filter(k => editFieldLabels[k])
  appliedKeys.value = new Set(appliedKeys.value)
  demo.toast(changes.length ? '선택한 제안을 적용했어요. 아직 저장되지 않았어요.' : '입력한 내용과 같은 제안이에요.')
  scrollToApplied()
}

function undoDraft() {
  if (!aiUndo) return
  let restored = 0
  let kept = 0
  for (const c of aiUndo.changes) {
    if (eqAi(getAiField(c.key), c.after)) {
      if (c.key === 'tags') tags.value = c.before as string[]
      else if (c.key === 'summary') description.value = c.before as string
      else if (c.key === 'title') title.value = c.before as string
      else if (c.key === 'severity') severity.value = c.before as number | null
      else exceptionClass.value = c.before as string
      appliedKeys.value.delete(c.key)
      restored++
    } else kept++
  }
  if (aiUndo.previousMeta && severity.value == null && !exceptionClass.value) showAiMeta.value = false
  aiUndo = null
  aiUndoAvailable.value = false
  aiApplied.value = false
  appliedKeys.value = new Set(appliedKeys.value)
  demo.toast(kept ? `${restored}개 항목을 되돌렸어요. 직접 수정한 ${kept}개는 유지했어요.` : 'AI 적용 전 내용으로 되돌렸어요.')
}

function jumpToEdit(key: string) {
  if (key === 'summary') previewMode.value = false
  const id = key === 'title' ? 'f-title-input' : key === 'summary' ? 'f-desc-input' : key === 'tags' ? 'f-tag-input' : 'f-severity-input'
  nextTick(() => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    ;(el as HTMLElement).focus()
  })
}

// 직접 수정 시 배지 해제 + (미리보기 열려 있으면) 그 제안 체크 해제
function onEditField(key: string) {
  appliedKeys.value.delete(key)
  appliedKeys.value = new Set(appliedKeys.value)
  if (aiResult.value && aiSelected.value[key]) { aiSelected.value = { ...aiSelected.value, [key]: false }; aiEdited.value = { ...aiEdited.value, [key]: true } }
}

// 원문이 바뀌면 직전 분석 결과는 무효(조용히) — 새 원문으로 다시 분석.
watch(paste, () => invalidateAi())

async function onSubmit() {
  // 게스트(데모)는 입력만 체험 — 저장하지 않고 가입 전환 다이얼로그로 안내한다.
  if (authStore.isGuest) {
    demo.openDialog('signup')
    return
  }
  const snippetMarkerIds = snippetMarkers.value.map(s => s.markerId)
  const attachmentMarkerIds = attachmentMarkers.value.map(a => a.markerId)

  const wsId = visibility.value === 'WORKSPACE' ? workspaceId.value : null

  if (isEdit && caseId) {
    await errorApi.update(caseId, {
      title: title.value,
      project: scope.value || null,
      paste: paste.value || null,
      description: description.value || null,
      visibility: visibility.value,
      snippetMarkerIds,
      attachmentMarkerIds,
      tags: tags.value,
    })
    router.push({ name: 'errorDetail', params: { slug: teamStore.currentSlug, id: caseId } })
  } else {
    const { data } = await errorApi.create({
      title: title.value,
      project: scope.value || undefined,
      paste: paste.value || '',
      description: description.value || undefined,
      visibility: visibility.value,
      workspaceId: wsId ?? undefined,
      snippetMarkerIds,
      attachmentMarkerIds,
      tags: tags.value.length ? tags.value : undefined,
      severity: severity.value ?? undefined,
    })
    router.push({ name: 'errorDetail', params: { slug: teamStore.currentSlug, id: data.id } })
  }
}

async function saveSnippet(data: SnippetCreateRequest) {
  const res = await snippetApi.create(data)
  // Keep the just-entered code locally so the card can preview it (create response omits code).
  snippetMarkers.value.push({ ...res.data, code: data.code })
  showSnippetModal.value = false
}

async function deleteSnippet(markerId: string) {
  await snippetApi.delete(markerId)
  snippetMarkers.value = snippetMarkers.value.filter(s => s.markerId !== markerId)
}

async function saveAttachment(data: { title?: string; caption?: string; file: File }) {
  const res = await attachmentApi.upload(data)
  attachmentMarkers.value.push(res.data)
  showAttachmentModal.value = false
}

async function deleteAttachment(markerId: string) {
  await attachmentApi.delete(markerId)
  attachmentMarkers.value = attachmentMarkers.value.filter(a => a.markerId !== markerId)
}

// ── 미연결(pending) 자료 복원 (새 케이스 작성 시만) ──
// /mine 은 케이스에 아직 연결 안 한 내 업로드 전부(=여러 초안 것이 섞일 수 있음)를 돌려준다.
// 새로고침·이탈 후에도 서버에 24h 남아있어, 여기서 다시 불러와 이어붙일 수 있게 한다.
const pendingAttachments = ref<MyPendingAttachment[]>([])
const pendingSnippets = ref<MyPendingSnippet[]>([])
const pendingDismissed = ref(false)
const pendingTipOpen = ref(false)
const pendingTotal = computed(() => pendingAttachments.value.length + pendingSnippets.value.length)
const showPending = computed(() => !isEdit && !pendingDismissed.value && pendingTotal.value > 0)

async function loadPending() {
  if (isEdit) return
  const [a, s] = await Promise.allSettled([attachmentApi.listMine(), snippetApi.listMine()])
  if (a.status === 'fulfilled') pendingAttachments.value = a.value.data
  if (s.status === 'fulfilled') pendingSnippets.value = s.value.data
}

function restoreAttachment(p: MyPendingAttachment) {
  // AttachmentCard 는 markerId 로 썸네일을 직접 받아오므로 storageUrl 은 비워도 된다.
  attachmentMarkers.value.push({
    markerId: p.markerId, embedToken: p.embedToken, fileName: p.fileName,
    contentType: p.contentType, size: p.size, kind: p.kind, storageUrl: '',
  })
  pendingAttachments.value = pendingAttachments.value.filter(x => x.markerId !== p.markerId)
}
function restoreSnippet(p: MyPendingSnippet) {
  snippetMarkers.value.push({
    markerId: p.markerId, embedToken: p.embedToken, title: p.title,
    language: p.language, caption: p.caption, code: p.code,
  })
  pendingSnippets.value = pendingSnippets.value.filter(x => x.markerId !== p.markerId)
}
async function discardAttachment(p: MyPendingAttachment) {
  pendingAttachments.value = pendingAttachments.value.filter(x => x.markerId !== p.markerId)
  await attachmentApi.delete(p.markerId).catch(() => {})
}
async function discardSnippet(p: MyPendingSnippet) {
  pendingSnippets.value = pendingSnippets.value.filter(x => x.markerId !== p.markerId)
  await snippetApi.delete(p.markerId).catch(() => {})
}
function restoreAllPending() {
  pendingAttachments.value.slice().forEach(restoreAttachment)
  pendingSnippets.value.slice().forEach(restoreSnippet)
}
function discardAllPending() {
  const atts = pendingAttachments.value.slice()
  const snips = pendingSnippets.value.slice()
  pendingAttachments.value = []
  pendingSnippets.value = []
  atts.forEach(p => attachmentApi.delete(p.markerId).catch(() => {}))
  snips.forEach(p => snippetApi.delete(p.markerId).catch(() => {}))
}

onMounted(async () => {
  await loadError()
  loadPending()
  // 로그인 전환 후 돌아온 사용자의 초안 복원(신규 작성 모드).
  if (!isEdit) restoreDraft()
})
</script>

<template>
  <div :class="showSimilar ? 'mx-auto max-w-[1080px] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_392px] gap-11 items-start' : 'max-w-2xl mx-auto'">
    <svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"><defs>
      <symbol id="i-spark" viewBox="0 0 24 24"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4M18 4h4" /></symbol>
      <symbol id="i-code" viewBox="0 0 24 24"><path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16" /></symbol>
      <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></symbol>
      <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v.1" /></symbol>
      <symbol id="i-checkcircle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></symbol>
      <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6" /></symbol>
      <symbol id="i-close" viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6" /></symbol>
    </defs></svg>
    <div class="min-w-0">
    <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100" :class="authStore.isGuest ? 'mb-6' : 'mb-10'">
      {{ isEdit ? 'Edit Error' : 'New Entry' }}
    </h1>

    <DemoNotice v-if="authStore.isGuest" class="mb-8">
      <template v-if="onAiTourStep"><b>회원 체험 모드</b> — AI 분석과 제안 적용을 테스트할 수 있어요. 실제 AI 호출·저장은 진행되지 않아요.</template>
      <template v-else><b>데모 미리보기</b> — 입력은 해볼 수 있지만 저장되지 않아요. 가입하면 내 워크스페이스에 실제로 기록됩니다.</template>
    </DemoNotice>

    <!-- 미연결(pending) 자료 안내 배너 — 새 케이스 작성 시만 -->
    <div
      v-if="showPending"
      class="flex items-center gap-2.5 rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-3.5 py-2.5 mb-8"
    >
      <ClockIcon class="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span class="flex-1 text-[13px] text-zinc-700 dark:text-zinc-200">
        최근 올렸지만 아직 연결 안 한 자료 <b class="font-semibold">{{ pendingTotal }}개</b>가 있어요<span
          class="help-wrap"
          :class="{ open: pendingTipOpen }"
          @click.stop="pendingTipOpen = !pendingTipOpen"
        >
          <button type="button" class="help-btn" aria-label="자세히">?</button>
          <span class="help-tip">
            <b>이 케이스 전용이 아니에요.</b> 케이스에 연결 안 한 내 최근 업로드 전부를 보여줘요(다른 초안 것도 섞일 수 있음). 필요한 것만 골라 붙이면 되고, 그냥 두면 <b>24시간 뒤 자동 정리</b>돼요.
          </span>
        </span>
      </span>
      <div class="flex shrink-0 gap-3">
        <button type="button" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline" @click="restoreAllPending">모두 복원</button>
        <button type="button" class="text-xs font-semibold text-zinc-400 hover:text-rose-500 transition-colors" @click="discardAllPending">모두 지우기</button>
      </div>
    </div>

    <!-- 게스트는 저장하지 않으므로 필수값 검사 없이 바로 가입 안내로 -->
    <form class="space-y-10 ea-ai" :novalidate="authStore.isGuest" @submit.prevent="onSubmit">
      <div>
        <input id="f-title-input" ref="titleInput" v-model="title" @input="onTitleInput(); onEditField('title')" type="text" placeholder="Error title" class="raw-input w-full text-lg font-medium" :class="{ 'ai-flashed': aiFlash.has('title') }" required />
        <p v-if="appliedKeys.has('title')" class="ea-field-hint">AI 제안을 적용했어요. 자유롭게 수정하세요.</p>
      </div>
      <div>
        <input v-model="scope" type="text" placeholder="Project (optional)" class="raw-input w-full text-sm" />
      </div>
      <div class="group">
        <label class="text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:group-focus-within:text-white mb-3 flex items-center gap-2">Tags <span v-if="appliedKeys.has('tags')" class="field-ai-badge"><svg class="icon" aria-hidden="true"><use href="#i-spark" /></svg>AI 제안</span></label>
        <div class="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 min-h-[38px]" :class="{ 'ai-flashed': aiFlash.has('tags') }">
          <span
            v-for="tag in tags"
            :key="tag"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs"
          >
            {{ tag }}
            <button type="button" class="hover:text-emerald-900 dark:hover:text-emerald-100" @click="removeTag(tag)">&times;</button>
          </span>
          <input
            id="f-tag-input"
            v-model="tagInput"
            type="text"
            placeholder="Add tag and press Enter"
            class="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
            @keydown.enter="addTag"
          />
        </div>
      </div>
      <div class="group">
        <div class="trace-head flex items-center justify-between gap-3 mb-3" data-tour="ai-button">
          <label data-tour-chip class="text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:group-focus-within:text-white">Error Trace <span class="text-zinc-400 dark:text-zinc-600">(optional)</span></label>
          <div class="flex items-center gap-2">
            <button v-if="authStore.isGuest" type="button" class="guest-own-ai-button" @click="requestMemberAuth">
              <svg class="icon" aria-hidden="true"><use href="#i-lock" /></svg><span>내 로그 분석</span>
            </button>
            <button type="button" class="ai-button" :disabled="aiDisabled" @click="analyzeDraft">
              <span v-if="aiBusy" class="spin" aria-hidden="true" /><svg v-else class="icon" aria-hidden="true"><use href="#i-spark" /></svg>
              <span>{{ aiButtonLabel }}</span>
            </button>
          </div>
        </div>
        <textarea v-model="paste" placeholder="Paste error output / stack trace" rows="4" maxlength="20000" class="raw-textarea w-full font-mono text-xs" />
        <div class="trace-tools">
          <button v-if="authStore.isGuest" type="button" class="text-button" @click="openSamplePicker"><svg class="icon" aria-hidden="true"><use href="#i-code" /></svg>다른 예제 불러오기</button>
          <span v-if="!authStore.isGuest" class="trace-tools-note">에러 원문에서 제목·요약·태그·심각도를 제안해 드려요.</span>
          <span class="trace-count tabular-nums">{{ traceCount.toLocaleString() }} / 20,000</span>
        </div>
        <p v-if="authStore.isGuest" class="trace-caption">샘플 결과 보기는 입력한 원문을 분석하지 않아요. 내 로그를 분석하려면 「내 로그 분석」을 누르세요.</p>

        <div id="ai-slot">
          <section v-if="authStore.isGuest && showGuestSample" data-tour="ai-preview" class="ai-preview guest-example-preview" aria-label="샘플 AI 제안 미리보기">
            <div class="ai-preview-head">
              <h3 class="ai-heading"><svg class="icon" aria-hidden="true"><use href="#i-spark" /></svg>샘플 AI 제안 미리보기</h3>
              <span class="guest-demo-label">DEMO · 예시 결과</span>
            </div>
            <div class="guest-example-intro"><strong>로그인 없이 AI가 만들어 주는 결과를 살펴보세요.</strong><br />아래는 미리 준비된 예시예요. <strong>현재 입력한 에러 원문을 분석한 결과가 아니며</strong>, 폼에 적용되지 않아요.</div>
            <div class="guest-sample-tabs" role="group" aria-label="샘플 에러 선택">
              <button v-for="s in DEMO_SAMPLES" :key="s.id" type="button" class="guest-sample-tab" :class="{ 'is-active': s.id === guestSampleId }" :aria-pressed="s.id === guestSampleId" @click="guestSampleId = s.id">{{ s.tabLabel }}</button>
            </div>
            <div class="ai-rows">
              <div class="ai-row guest-preview-row"><span class="ai-key">제목</span><span class="ai-value guest-example-value">{{ guestSample.result.title }}</span></div>
              <div class="ai-row guest-preview-row"><span class="ai-key">예외</span><span class="ai-value guest-example-value mono">{{ guestSample.result.exceptionClass || '예시 데이터에 없음' }}</span></div>
              <div class="ai-row guest-preview-row"><span class="ai-key">요약</span><span class="ai-value guest-example-value">{{ guestSample.result.summary }}</span></div>
              <div class="ai-row guest-preview-row"><span class="ai-key">태그</span><span class="ai-value guest-example-value"><span class="ai-tags"><span v-for="t in guestSample.result.tags" :key="t" class="tag">{{ t }}</span></span></span></div>
              <div class="ai-row guest-preview-row"><span class="ai-key">심각도</span><span class="ai-value guest-example-value"><span v-if="guestSample.result.severity" class="severity-pill"><i class="pip" :style="{ '--s-color': sevColor(guestSample.result.severity.code) }" />{{ guestSample.result.severity.name }} · {{ guestSample.result.severity.label }}</span><span v-else>예시 데이터에 없음</span></span></div>
            </div>
            <details class="guest-sample-source"><summary>이 제안에 사용된 샘플 에러 원문 보기</summary><pre>{{ guestSample.raw }}</pre></details>
            <div class="ai-preview-foot">
              <p>내 로그를 분석하거나 제안을 폼에 적용하려면 로그인이 필요해요.</p>
              <div class="ai-preview-actions guest-sample-actions">
                <button type="button" class="button compact" @click="showGuestSample = false">닫기</button>
                <button type="button" class="button compact primary" @click="requestMemberAuth">내 로그로 AI 분석하기 <svg class="icon" aria-hidden="true"><use href="#i-arrow" /></svg></button>
              </div>
            </div>
          </section>

          <div v-if="aiBusy" class="analysis-status" aria-live="polite">
            <span class="spin" aria-hidden="true" />
            <div><span>{{ aiProgress }}</span><small>입력한 원문은 폼에 그대로 유지돼요.</small></div>
            <button type="button" class="cancel-analysis" @click="cancelAnalyze">취소</button>
          </div>
          <div v-else-if="aiError" class="analysis-status error-status" aria-live="polite">
            <svg class="icon" aria-hidden="true"><use href="#i-info" /></svg>
            <div class="flex-1 min-w-0">분석 요청을 완료하지 못했어요.<small>입력한 내용은 그대로예요. 잠시 후 다시 시도해 주세요.</small></div>
            <button type="button" class="retry-button" @click="analyzeDraft">재시도</button>
          </div>

          <section v-else-if="aiResult" class="ai-preview" :class="{ fallback: aiResult.degraded }" aria-label="AI 제안 미리보기">
            <div class="ai-preview-head">
              <h3 class="ai-heading"><svg class="icon" aria-hidden="true"><use :href="aiResult.degraded ? '#i-code' : '#i-spark'" /></svg>{{ aiResult.degraded ? '규칙 기반 추출' : 'AI 제안 미리보기' }}</h3>
              <span class="confidence">{{ aiResult.degraded ? 'AI 사용 불가 · 원문 추출' : 'AI 제안' }}</span>
            </div>
            <p class="ai-intro">{{ aiResult.degraded ? 'AI 분석을 사용할 수 없어 원문에서 확인한 내용만 가져왔어요. 없는 값은 기존 내용을 유지합니다.' : '적용할 항목을 선택해 주세요. 기존 작성 내용은 기본적으로 유지돼요. 적용 후에는 실제 폼에서 수정할 수 있어요.' }}</p>
            <label v-for="row in aiRows" :key="row.key" class="ai-row" :class="{ disabled: !row.available }">
              <input type="checkbox" :disabled="!row.available" v-model="aiSelected[row.key]" :aria-label="`${row.label} 적용`" />
              <span class="ai-key">{{ row.label }}<small v-if="row.sourceLabel" class="source-label">원문 추출</small></span>
              <span class="ai-value" :class="{ mono: row.key === 'exceptionClass', empty: !row.available }">
                <template v-if="row.available">
                  <span v-if="row.isTags" class="ai-tags"><span v-for="t in row.tags" :key="t" class="tag">{{ t }}</span></span>
                  <span v-else-if="row.isSeverity" class="severity-pill"><i class="pip" :style="{ '--s-color': sevColor(row.sevCode) }" />{{ row.display }}</span>
                  <template v-else>{{ row.display }}</template>
                  <small v-if="aiKeepNote(row)" class="keep-note">{{ aiKeepNote(row) }}</small>
                </template>
                <template v-else>{{ row.isSeverity ? '판단할 수 없어 제안하지 않아요.' : '추출된 내용 없음 · 기존 값 유지' }}</template>
              </span>
            </label>
            <div class="ai-preview-foot">
              <p>{{ aiResult.degraded ? '요약·태그·심각도는 직접 작성할 수 있어요.' : '심각도는 제안이에요. 실제 영향도를 확인해 주세요.' }}</p>
              <div class="ai-preview-actions">
                <button type="button" class="button compact" @click="dismissPreview">닫기</button>
                <button type="button" class="button compact primary" :disabled="!aiSelectedCount" @click="applyDraft">{{ aiSelectedCount ? `${aiSelectedCount}개 항목 적용` : '적용할 항목 선택' }}</button>
              </div>
            </div>
          </section>
        </div>

        <div v-if="aiApplied" id="ai-applied-note" class="applied" aria-live="polite">
          <div class="applied-top">
            <svg class="icon" aria-hidden="true"><use href="#i-checkcircle" /></svg>
            <div class="applied-message">
              <strong>{{ aiAppliedCopy }}</strong>
              <span>{{ aiAppliedHint }}</span>
            </div>
            <button v-if="aiUndoAvailable" type="button" class="applied-undo" @click="undoDraft">되돌리기</button>
          </div>
          <div v-if="aiAppliedEditKeys.length" class="applied-edit">
            <span class="applied-edit-label">바로 수정</span>
            <div class="applied-links">
              <button v-for="k in aiAppliedEditKeys" :key="k" type="button" class="applied-edit-button" @click="jumpToEdit(k)">{{ editFieldLabels[k] }} <svg class="icon" aria-hidden="true"><use href="#i-arrow" /></svg></button>
            </div>
          </div>
        </div>
      </div>
      <div class="group">
        <label class="text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:group-focus-within:text-white block mb-3 flex items-center gap-2">Description <span v-if="appliedKeys.has('summary')" class="field-ai-badge"><svg class="icon" aria-hidden="true"><use href="#i-spark" /></svg>AI 제안</span></label>
        <div class="flex items-center gap-4 mb-2">
          <div class="flex items-center gap-4 text-xs">
            <button type="button" class="relative pb-0.5 transition-colors" :class="!previewMode ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'" @click="previewMode = false">
              Write
              <span v-if="!previewMode" class="absolute left-0 right-0 -bottom-px h-px bg-emerald-500" />
            </button>
            <button type="button" class="relative pb-0.5 transition-colors" :class="previewMode ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'" @click="previewMode = true">
              Preview
              <span v-if="previewMode" class="absolute left-0 right-0 -bottom-px h-px bg-emerald-500" />
            </button>
          </div>
          <div class="flex items-center gap-1 ml-auto">
            <button type="button" class="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors" @click="showSnippetModal = true">
              <CodeBracketIcon class="w-3.5 h-3.5" />
              Code Snippet
            </button>
            <button type="button" class="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors" @click="showAttachmentModal = true">
              <PaperClipIcon class="w-3.5 h-3.5" />
              Attachment
            </button>
          </div>
        </div>
        <textarea id="f-desc-input" v-show="!previewMode" ref="descriptionRef" v-model="description" @input="onEditField('summary')" placeholder="Description — additional context" rows="5" class="raw-textarea w-full" :class="{ 'ai-flashed': aiFlash.has('summary') }" />
        <div v-show="previewMode" class="min-h-[7rem] border-l-2 border-zinc-200 dark:border-zinc-700 pl-4">
          <BodyRenderer
            v-if="previewMode && description.trim()"
            :content="description"
            :snippets="previewSnippets"
            :attachments="previewAttachments"
            editable
            @resize="onImageResize"
          />
          <p v-else class="text-sm text-zinc-400 dark:text-zinc-500">Nothing to preview yet — write a description or insert a snippet/attachment.</p>
          <p v-if="previewMode && description.trim()" class="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">Tip: drag the handle on an image's right edge to resize it.</p>
        </div>
      </div>
      <div v-if="showAiMeta" class="group grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_180px] gap-6">
        <div>
          <label for="f-exception-input" class="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-2">Exception class <span class="pill">원문 추출</span></label>
          <input id="f-exception-input" v-model="exceptionClass" readonly placeholder="추출된 예외 없음" class="raw-input w-full font-mono text-[11px]" />
          <p class="text-[11px] text-zinc-400 mt-1">원문에서 확인한 예외 클래스예요.</p>
        </div>
        <div>
          <label for="f-severity-input" class="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-2">Severity <span class="text-zinc-400 font-normal">(optional)</span></label>
          <select id="f-severity-input" v-model="severity" class="raw-input text-sm w-full" :class="{ 'ai-flashed': aiFlash.has('severity') }" @change="onEditField('severity')">
            <option :value="null">미지정</option>
            <option :value="1">S1 · Outage</option>
            <option :value="2">S2 · Degraded</option>
            <option :value="3">S3 · Minor</option>
            <option :value="4">S4 · Info</option>
          </select>
          <p class="text-[11px] text-zinc-400 mt-1">실제 영향도를 확인해 수정하세요.</p>
        </div>
      </div>
      <div class="group">
        <label class="text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:group-focus-within:text-white block mb-3">Visibility</label>
        <select v-model="visibility" class="raw-input text-sm">
          <option value="PRIVATE">Private</option>
          <option value="WORKSPACE">Workspace</option>
          <option value="PUBLIC">Public</option>
        </select>
      </div>
      <div v-if="visibility === 'WORKSPACE'" class="group">
        <label class="text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:group-focus-within:text-white block mb-3">Workspace</label>
        <select v-model="workspaceId" class="raw-input text-sm" required>
          <option :value="null" disabled>Select workspace</option>
          <option v-for="ws in workspaces" :key="ws.workspaceId" :value="ws.workspaceId">{{ ws.name }}</option>
        </select>
        <p v-if="!workspaces.length" class="text-xs text-zinc-400 mt-1">No workspaces found. Create one first.</p>
      </div>

      <div class="flex gap-3 pt-6">
        <button type="submit" class="px-6 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
          {{ isEdit ? 'Update' : 'Create' }}
        </button>
        <button type="button" class="px-6 py-2 text-sm font-medium rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 transition-colors" @click="router.back()">
          Cancel
        </button>
      </div>
    </form>

    <div v-if="showPending || snippetMarkers.length || attachmentMarkers.length" class="mt-10 space-y-2">
      <h3 class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Snippets & Attachments</h3>

      <!-- 연결 안 한 자료: 카드별 개별 복원/지우기 -->
      <template v-if="showPending">
        <p class="pt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">연결 안 한 자료 {{ pendingTotal }}개</p>
        <div
          v-for="p in pendingSnippets"
          :key="'ps-' + p.markerId"
          class="flex items-center gap-3 rounded-xl border border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/60 dark:bg-amber-900/15 px-3 py-2.5"
        >
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
            <CodeBracketIcon class="h-4 w-4" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-200">{{ p.title || '코드 스니펫' }}</p>
            <p class="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{{ p.language }}</p>
          </div>
          <div class="flex shrink-0 gap-2.5">
            <button type="button" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline" @click="restoreSnippet(p)">복원</button>
            <button type="button" class="text-xs text-zinc-400 hover:text-rose-500 transition-colors" @click="discardSnippet(p)">지우기</button>
          </div>
        </div>
        <div
          v-for="p in pendingAttachments"
          :key="'pa-' + p.markerId"
          class="flex items-center gap-3 rounded-xl border border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/60 dark:bg-amber-900/15 px-3 py-2.5"
        >
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
            <PaperClipIcon class="h-4 w-4" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-200">{{ p.title || p.fileName }}</p>
            <p class="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{{ (p.size / 1024).toFixed(1) }}KB</p>
          </div>
          <div class="flex shrink-0 gap-2.5">
            <button type="button" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline" @click="restoreAttachment(p)">복원</button>
            <button type="button" class="text-xs text-zinc-400 hover:text-rose-500 transition-colors" @click="discardAttachment(p)">지우기</button>
          </div>
        </div>
      </template>

      <SnippetCard
        v-for="snp in snippetMarkers"
        :key="snp.markerId"
        :snippet="snp"
        @insert="insertAtCursor"
        @delete="() => deleteSnippet(snp.markerId)"
      />
      <AttachmentCard
        v-for="att in attachmentMarkers"
        :key="att.markerId"
        :attachment="att"
        @insert="insertAtCursor"
        @delete="() => deleteAttachment(att.markerId)"
      />
    </div>

    <SnippetModal v-if="showSnippetModal" @save="saveSnippet" @close="showSnippetModal = false" />
    <AttachmentModal v-if="showAttachmentModal" @save="saveAttachment" @close="showAttachmentModal = false" />
    </div>

    <aside v-if="showSimilar" data-tour="similar" class="lg:sticky lg:top-6 lg:mt-3">
      <SimilarCasesPanel :items="panelItems" :query="title" :loading="panelLoading" :slug="teamStore.currentSlug" />
    </aside>

    <Teleport to="body">
      <div v-if="showAiGuestModal" class="overlay" @click.self="closeAiGuestModal">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="ai-guest-title">
          <button type="button" class="icon-btn" aria-label="닫기" @click="closeAiGuestModal"><svg class="icon" aria-hidden="true"><use href="#i-close" /></svg></button>
          <div class="auth-gate">
            <div class="auth-gate-head">
              <div class="auth-gate-icon"><svg class="icon" aria-hidden="true"><use href="#i-spark" /></svg></div>
              <div class="grow">
                <div class="auth-eyebrow">MEMBERS ONLY · AI ASSIST</div>
                <h2 id="ai-guest-title">내 에러도 AI로<br />정리해 보세요</h2>
                <p>샘플 체험을 마쳤다면, 이제 내 에러 로그를 분석해 보세요.<br />로그인하면 제목·설명·태그 제안을 받아볼 수 있어요.</p>
              </div>
            </div>
            <div class="auth-gate-kept"><svg class="icon" aria-hidden="true"><use href="#i-checkcircle" /></svg><span><b>작성 내용은 유지돼요.</b> 현재 입력한 원문과 제목, 설명을 지우지 않습니다.</span></div>
            <div class="modal-actions">
              <button type="button" class="button compact" @click="closeAiGuestModal">계속 작성하기</button>
              <button type="button" class="button compact primary" @click="goSignupFromAi">로그인하고 계속 <svg class="icon" aria-hidden="true"><use href="#i-arrow" /></svg></button>
            </div>
            <div class="auth-gate-secondary"><span>처음 이용하시나요?</span><button type="button" @click="goSignupFromAi">GitHub로 회원가입하기</button></div>
          </div>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showSamplePicker" class="overlay" @click.self="showSamplePicker = false">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="sample-picker-title">
          <button type="button" class="icon-btn" aria-label="닫기" @click="showSamplePicker = false"><svg class="icon" aria-hidden="true"><use href="#i-close" /></svg></button>
          <div class="eyebrow">SAMPLE ERROR TRACE</div>
          <h2 id="sample-picker-title">어떤 에러로 테스트할까요?</h2>
          <p>원문만 바뀝니다. 작성한 제목·태그·설명은 유지돼요.</p>
          <div style="display:grid;gap:9px;margin-top:20px">
            <button v-for="s in DEMO_SAMPLES" :key="s.id" type="button" class="asset-row" style="margin:0;text-align:left;padding:14px 16px;cursor:pointer" @click="loadSample(s)">
              <strong style="font-size:13px">{{ s.label }}</strong><span style="display:block;font-size:11px;color:var(--soft);margin-top:4px">{{ s.detail }}</span>
            </button>
          </div>
          <div class="modal-actions">
            <button type="button" class="button compact" @click="clearTrace">원문 비우기</button>
            <button type="button" class="button compact" @click="showSamplePicker = false">취소</button>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* pending 안내 배너의 "?" 도움말 툴팁 (아래로 드롭) */
.help-wrap {
  position: relative;
  display: inline-flex;
  vertical-align: middle;
  margin-left: 4px;
}
.help-btn {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1px solid #a1a1aa;
  color: #71717a;
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: transparent;
  padding: 0;
  transition: color 0.13s, border-color 0.13s;
}
.help-btn:hover { border-color: #71717a; color: #52525b; }
.help-tip {
  position: absolute;
  top: calc(100% + 9px);
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  width: 250px;
  background: #fff;
  color: #3f3f46;
  border: 1px solid #e4e4e7;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  padding: 11px 13px;
  font-size: 11.5px;
  line-height: 1.55;
  font-weight: 400;
  opacity: 0;
  visibility: hidden;
  transition: all 0.16s;
  z-index: 30;
  text-align: left;
}
.help-tip::after {
  content: "";
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-bottom-color: #fff;
}
.help-tip b { font-weight: 600; color: #18181b; }
.help-wrap:hover .help-tip,
.help-wrap.open .help-tip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}
:global(.dark) .help-btn { border-color: #52525b; color: #a1a1aa; }
:global(.dark) .help-btn:hover { border-color: #a1a1aa; color: #d4d4d8; }
:global(.dark) .help-tip { background: #1f1f23; color: #d4d4d8; border-color: #3f3f46; }
:global(.dark) .help-tip::after { border-bottom-color: #1f1f23; }
:global(.dark) .help-tip b { color: #f4f4f5; }

/* ===== AI 영역 — 사용자 목업 CSS 그대로 (tokens + verbatim) ===== */
.ea-ai{--green:#059669;--green-bright:#10b981;--green-soft:#ecfdf5;--green-line:#a7f3d0;--surface:#fff;--ink:#18181b;--label:#71717a;--muted:#52525b;--soft:#a1a1aa;--line:#e4e4e7;--strong:#d4d4d8;--hover:#f4f4f5;--eabg:#f7f7f5;--mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Consolas,monospace}
:global(.dark) .ea-ai{--green:#34d399;--green-bright:#10b981;--green-soft:#052e23;--green-line:#24614a;--surface:#202023;--ink:#f4f4f5;--label:#a1a1aa;--muted:#a1a1aa;--soft:#71717a;--line:#3f3f46;--strong:#52525b;--hover:#27272a;--eabg:#18181b}
.ea-ai .tag{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border:1px solid var(--line);border-radius:4px;font-size:12px;color:var(--muted)}
.icon{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;flex:none;vertical-align:middle}
.ai-button .icon{width:14px;height:14px}
.ai-heading .icon{width:15px;height:15px}
.text-button .icon{width:13px;height:13px}
.field-ai-badge .icon{width:11px;height:11px}
.error-status .icon{width:18px;height:18px}
.guest-own-ai-button .icon{width:12px;height:12px;color:var(--green)}
.applied-top .icon{width:16px;height:16px;color:var(--green);margin-top:1px}
.applied-edit-button .icon{width:11px;height:11px}
.button .icon{width:14px;height:14px}
.trace-tools{display:flex;align-items:center;gap:12px;justify-content:space-between;margin-top:10px;font-size:11px;color:var(--soft)}
.trace-count{margin-left:auto}
.trace-tools-note{font-size:11px;color:var(--soft);min-width:0}
.text-button{font-size:11px;color:var(--label);display:inline-flex;align-items:center;gap:5px;background:none;border:0;cursor:pointer}
.text-button:hover{color:var(--green)}
.trace-caption{font-size:11px;color:var(--soft);margin-top:10px;line-height:1.7}
.ai-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--green-line);border-radius:9px;background:var(--green-soft);color:var(--green);padding:6px 11px;font-size:12px;font-weight:500;white-space:nowrap;cursor:pointer}
.ai-button:hover:not(:disabled){border-color:var(--green-bright);background:color-mix(in srgb,var(--green-soft),var(--green-bright) 5%)}
.ai-button:disabled{opacity:.55;cursor:not-allowed}
.spin{display:inline-block;width:13px;height:13px;border:1.5px solid var(--green-line);border-top-color:var(--green);border-radius:50%;animation:spin .8s linear infinite;flex:none}
@keyframes spin{to{transform:rotate(360deg)}}
.ai-preview{margin-top:18px;border:1px solid var(--green-line);border-radius:12px;background:var(--surface);overflow:hidden;animation:rise .22s ease-out}
.ai-preview.fallback{border-color:var(--strong)}
@keyframes rise{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.ai-preview-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;background:color-mix(in srgb,var(--green-soft) 45%,var(--surface));border-bottom:1px solid var(--line)}
.fallback .ai-preview-head{background:var(--hover)}
.ai-heading{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:var(--green);margin:0}
.fallback .ai-heading{color:var(--muted)}
.confidence{font-size:10px;color:var(--label);font-variant-numeric:tabular-nums}
.ai-intro{padding:12px 16px 5px;font-size:11.5px;line-height:1.7;color:var(--muted)}
.ai-intro strong{color:var(--ink);font-weight:500}
.ai-row{display:grid;grid-template-columns:18px 64px minmax(0,1fr);gap:10px;align-items:start;margin:0 16px;padding:13px 0;border-bottom:1px dashed var(--line);cursor:pointer}
.ai-row:last-child{border:0}
.ai-row input{accent-color:var(--green-bright);width:15px;height:15px;margin:3px 0}
.ai-key{font-size:11.5px;font-weight:500;color:var(--label);padding-top:1px}
.ai-value{font-size:12.5px;line-height:1.65;overflow-wrap:anywhere;color:var(--ink)}
.ai-value.mono{font-size:11px;font-family:var(--mono)}
.ai-value.empty{color:var(--soft);font-size:11.5px}
.ai-row.disabled{cursor:default}
.source-label{display:block;font-size:9px;color:var(--soft);margin-top:4px;font-weight:400}
.ai-tags{display:flex;flex-wrap:wrap;gap:5px}
.ai-tags .tag{font-size:10.5px;color:var(--green);border-color:var(--green-line);background:var(--green-soft);padding:2px 7px}
.keep-note{display:block;font-size:10px;color:#a16207;margin-top:5px}
:global(.dark) .keep-note{color:#d6b66b}
.severity-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px}
.pip{width:7px;height:7px;border-radius:50%;background:var(--s-color,#f59e0b);display:inline-block;flex:none}
.ai-preview-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding:12px 16px;background:color-mix(in srgb,var(--eabg) 65%,var(--surface));flex-wrap:wrap}
.ai-preview-foot p{font-size:10.5px;color:var(--soft);flex:1;min-width:160px;margin:0}
.ai-preview-actions{display:flex;gap:8px}
.analysis-status{margin-top:16px;border:1px solid var(--line);border-radius:10px;padding:14px 16px;background:var(--surface);display:flex;gap:10px;align-items:center;font-size:12px;color:var(--muted)}
.analysis-status small{font-size:10.5px;color:var(--soft);display:block;margin-top:3px}
.analysis-status .cancel-analysis{margin-left:auto;font-size:11px;color:var(--soft);background:none;border:0;cursor:pointer}
.analysis-status .retry-button{font-size:11px;color:var(--label);text-decoration:underline;background:none;border:0;cursor:pointer;flex:none}
.error-status{border-color:#fecdd3;background:#fff1f2;color:#9f1239}
:global(.dark) .error-status{background:#351f25;border-color:#6e303c;color:#fda4af}
.button{padding:8px 24px;font-size:14px;font-weight:500;border-radius:12px;background:var(--hover);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;cursor:pointer;min-height:36px}
.button:hover{background:var(--line)}
.button.primary{background:#059669;color:#fff}
.button.primary:hover{background:#047857}
.button.compact{padding:7px 13px;font-size:12px;border-radius:8px}
.applied{display:block;border:1px solid var(--green-line);padding:13px 14px;border-radius:11px;background:color-mix(in srgb,var(--green-soft) 56%,var(--surface));color:var(--ink);margin-top:14px}
.applied-top{display:flex;align-items:flex-start;gap:10px}
.applied-message{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.applied-message strong{font-size:12px;font-weight:600;color:var(--ink);line-height:1.45}
.applied-message span{font-size:11px;color:var(--muted);line-height:1.55}
.applied-undo{margin-left:auto;white-space:nowrap;flex:none;font-size:11px;color:var(--label);text-decoration:underline;text-underline-offset:3px;padding:1px 0;background:none;border:0;cursor:pointer}
.applied-undo:hover{color:var(--green)}
.applied-edit{display:flex;align-items:center;flex-wrap:wrap;gap:8px;border-top:1px solid var(--green-line);margin-top:12px;padding-top:11px}
.applied-edit-label{font-size:10.5px;color:var(--label);white-space:nowrap;margin-right:3px}
.applied-links{display:flex;flex-wrap:wrap;gap:6px}
.applied-edit-button{display:inline-flex;align-items:center;gap:5px;background:var(--surface);border:1px solid var(--green-line);color:var(--green);font-size:11px;font-weight:500;border-radius:7px;padding:5px 9px;cursor:pointer}
.applied-edit-button:hover{background:var(--green-soft);border-color:var(--green-bright)}
.edit-target-highlight{outline:1px solid var(--green-bright);outline-offset:8px;border-radius:4px;animation:edit-focus-pulse 1.5s ease-out}
@keyframes edit-focus-pulse{0%{outline-color:var(--green-bright);background:color-mix(in srgb,var(--green-soft) 75%,transparent)}100%{outline-color:transparent;background:transparent}}
.field-ai-badge{font-size:9px;font-weight:500;color:var(--green);display:inline-flex;align-items:center;gap:3px}
.ea-field-hint{font-size:11px;color:var(--soft);margin-top:7px}
.pill{font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px;background:var(--green-soft);color:var(--green);display:inline-flex;align-items:center;gap:4px}
.flash{animation:flash 1.2s ease-out}
@keyframes flash{0%{background-color:rgba(16,185,129,.13)}100%{background-color:transparent}}
@media(prefers-reduced-motion:reduce){.spin,.ai-preview,.flash{animation:none}}
/* 게스트 샘플 체험 — 목업 verbatim */
.guest-own-ai-button{display:inline-flex;gap:5px;align-items:center;justify-content:center;border-radius:8px;border:1px solid var(--line);background:var(--surface);padding:7px 10px;font-size:11.5px;font-weight:500;color:var(--muted);white-space:nowrap;cursor:pointer}
.guest-own-ai-button:hover{background:var(--hover);border-color:var(--strong);color:var(--ink)}
.guest-example-preview{border-color:var(--green-line)}
/* 가이드 하이라이트: 스코프드 배경(.ai-preview surface + head/foot 틴트)이 global .tour-highlight 초록 채움(#f4faf6)을 덮으므로, 하이라이트 시 박스 내부까지 같은 초록으로 채운다(다른 영역 하이라이트와 동일한 "박스 내부 초록"). */
.tour-highlight.guest-example-preview,
.tour-highlight.guest-example-preview .ai-preview-head,
.tour-highlight.guest-example-preview .ai-preview-foot{background:#f4faf6 !important}
:global(.dark) .tour-highlight.guest-example-preview,
:global(.dark) .tour-highlight.guest-example-preview .ai-preview-head,
:global(.dark) .tour-highlight.guest-example-preview .ai-preview-foot{background:#202d25 !important}
.guest-demo-label{border:1px solid var(--green-line);color:var(--green);background:var(--green-soft);padding:2px 7px;border-radius:5px;font-size:9.5px;font-weight:600;letter-spacing:.03em;white-space:nowrap}
.guest-example-intro{margin:13px 16px 0;padding:11px 12px;border:1px solid var(--line);border-radius:9px;background:var(--hover);font-size:11.5px;color:var(--muted);line-height:1.65}
.guest-example-intro strong{color:var(--ink);font-weight:600}
.guest-sample-tabs{display:flex;gap:6px;flex-wrap:wrap;padding:14px 16px 2px}
.guest-sample-tab{font-size:11px;border:1px solid var(--line);background:var(--surface);border-radius:7px;padding:6px 10px;color:var(--label);cursor:pointer}
.guest-sample-tab:hover{border-color:var(--green-line);color:var(--ink)}
.guest-sample-tab.is-active{border-color:var(--green-line);background:var(--green-soft);color:var(--green);font-weight:600}
.guest-preview-row{cursor:default;grid-template-columns:64px minmax(0,1fr)}
.guest-example-value{white-space:normal}
.guest-sample-source{border-top:1px solid var(--line);padding:12px 16px 14px}
.guest-sample-source summary{color:var(--label);cursor:pointer;font-size:11px;list-style:none;display:flex;gap:7px;align-items:center}
.guest-sample-source summary:hover{color:var(--green)}
.guest-sample-source summary::before{content:'+';width:15px;height:15px;border:1px solid var(--line);border-radius:4px;display:grid;place-items:center;line-height:1;font-size:13px}
.guest-sample-source[open] summary::before{content:'−'}
.guest-sample-source pre{margin-top:12px;padding:12px;background:var(--hover);font:10.5px/1.7 var(--mono);white-space:pre-wrap;word-break:break-word;border-radius:8px;max-height:200px;overflow:auto;color:var(--muted)}
.guest-sample-actions{width:100%;justify-content:flex-end}

/* ===== 모달 — 사용자 목업(.overlay/.modal/.auth-gate/.asset-row/.eyebrow) 그대로. teleport 라 토큰은 .overlay 에 정의 ===== */
.overlay{--green:#059669;--green-soft:#ecfdf5;--green-line:#a7f3d0;--surface:#fff;--ink:#18181b;--label:#71717a;--muted:#52525b;--soft:#a1a1aa;--line:#e4e4e7;--hover:#f4f4f5;--mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Consolas,monospace;position:fixed;inset:0;background:rgba(24,24,27,.36);backdrop-filter:blur(3px);z-index:90;display:flex;align-items:center;justify-content:center;padding:20px}
:global(.dark) .overlay{--green:#34d399;--green-soft:#052e23;--green-line:#24614a;--surface:#202023;--ink:#f4f4f5;--label:#a1a1aa;--muted:#a1a1aa;--soft:#71717a;--line:#3f3f46;--hover:#27272a}
.modal{position:relative;width:100%;max-width:600px;max-height:88dvh;overflow-y:auto;background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:0 24px 80px #0002;padding:28px;line-height:1.5;color:var(--ink)}
.modal h2{font-size:19px;font-weight:600;margin-bottom:12px;color:var(--ink)}
.modal>.icon-btn{position:absolute;right:12px;top:12px}
.modal p{font-size:13px;color:var(--muted);line-height:1.8}
.modal .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:24px}
.modal .eyebrow{font:10px var(--mono);letter-spacing:.09em;color:var(--green);margin-bottom:12px}
.icon-btn{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;color:var(--label);background:none;border:0;cursor:pointer}
.icon-btn:hover{background:var(--hover);color:var(--ink)}
.icon-btn .icon{width:18px;height:18px}
.asset-row{border:1px solid var(--line);border-radius:12px;background:var(--surface)}
.asset-row:hover{border-color:var(--green-line)}
.grow{flex:1;min-width:0}
.auth-gate-head{display:flex;align-items:flex-start;gap:13px;padding:3px 0 8px}
.auth-gate-icon{width:43px;height:43px;background:var(--green-soft);border:1px solid var(--green-line);color:var(--green);border-radius:13px;display:grid;place-items:center;flex:none}
.auth-gate-icon .icon{width:20px;height:20px}
.auth-eyebrow{font-size:10px;letter-spacing:.06em;font-weight:600;color:var(--green)}
.auth-gate-head h2{font-size:19px;line-height:1.45;font-weight:600;margin:2px 0 7px}
.auth-gate-head p{font-size:12.5px;line-height:1.75}
.auth-gate-kept{display:flex;align-items:flex-start;gap:8px;margin:16px 0 4px;padding:12px 13px;background:var(--hover);border-radius:10px;color:var(--muted);font-size:11.5px}
.auth-gate-kept .icon{width:15px;height:15px;color:var(--green);margin-top:1px}
.auth-gate-secondary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:16px;margin-top:16px;border-top:1px solid var(--line);font-size:11px;color:var(--soft)}
.auth-gate-secondary button{font-size:11px;color:var(--green);font-weight:500;background:none;border:0;cursor:pointer}
@media(max-width:700px){.modal{padding:24px 20px}.auth-gate-head{gap:10px}.auth-gate-icon{width:38px;height:38px}.auth-gate-head h2{font-size:17px}.auth-gate-secondary{align-items:flex-start;flex-direction:column}}
</style>
