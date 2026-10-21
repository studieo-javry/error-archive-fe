<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import axios from 'axios'
import { formatAbsolute } from '@/utils/timeAgo'
import { useRoute, useRouter } from 'vue-router'
import { errorApi } from '@/services/errorApi'
import { meApi } from '@/services/meApi'
import { useTeamStore } from '@/stores/teamStore'
import { useAuthStore } from '@/stores/authStore'
import { stepApi } from '@/services/stepApi'
import { solutionApi } from '@/services/solutionApi'
import { commentApi } from '@/services/commentApi'
import type { ErrorCaseDetail, Step, Solution, Comment, CommentAuthor } from '@/types/error'
import ErrorStatusBadge from '@/components/error/ErrorStatusBadge.vue'
import TimelineList from '@/components/timeline/TimelineList.vue'
import StepForm, { type StepFormValues } from '@/components/timeline/StepForm.vue'
import SolutionSelector from '@/components/timeline/SolutionSelector.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import BodyRenderer from '@/components/common/BodyRenderer.vue'
import UntaggedAssets from '@/components/attachment/UntaggedAssets.vue'
import CommentThread from '@/components/comment/CommentThread.vue'
import CommentForm from '@/components/comment/CommentForm.vue'
import QuotePopup from '@/components/comment/QuotePopup.vue'
import PublishStatusBar from '@/components/publish/PublishStatusBar.vue'
import PublishSheet from '@/components/publish/PublishSheet.vue'
import { publishmentApi } from '@/services/publishmentApi'
import type { PublishmentDetail } from '@/types/publish'
import type { QuoteInfo } from '@/components/comment/CommentForm.vue'
import { StarIcon as StarOutlineIcon, HandRaisedIcon as HandOutlineIcon, LinkIcon } from '@heroicons/vue/24/outline'
import { StarIcon as StarSolidIcon, HandRaisedIcon as HandSolidIcon } from '@heroicons/vue/24/solid'

const route = useRoute()
const router = useRouter()
const teamStore = useTeamStore()
const authStore = useAuthStore()
const errorCase = ref<ErrorCaseDetail | null>(null)
const steps = ref<Step[]>([])
const solutions = ref<Solution[]>([])

// 발행 상태 — 소유자에게만 로드. null + pubLoaded=true 면 "미발행"(→ Publish 트리거),
// 값이 있으면 발행됨(→ 상태 바). 한 번 발행되면 unpublish 해도 null 로 돌아가지 않는다.
const publishment = ref<PublishmentDetail | null>(null)
const pubLoaded = ref(false)
const showPublishSheet = ref(false)
const comments = ref<Comment[]>([])
// userId → 표시 정보. 목록 응답의 authors(도움됨/리액션 누른 사람 포함) + 각 댓글의 임베드 author
// (새로 단 댓글도 자동 포함)를 합친다. helpful 팝오버 등 uid 만 있는 곳의 이름 해석용.
const commentAuthorDirectory = ref<CommentAuthor[]>([])
const commentAuthorMap = computed<Map<number, CommentAuthor>>(() => {
  const m = new Map<number, CommentAuthor>()
  for (const a of commentAuthorDirectory.value) m.set(a.userId, a)
  const walk = (list: Comment[]) => {
    for (const c of list) {
      if (c.author) m.set(c.author.userId, c.author)
      if (c.replies?.length) walk(c.replies)
    }
  }
  walk(comments.value)
  return m
})
const loading = ref(true)
const selectionMode = ref(false)
const selectedStepIds = ref<Set<number>>(new Set())
const activeFilter = ref<number | null>(null)

const highlightedStepIds = computed<Set<number> | null>(() => {
  if (activeFilter.value === null) return null
  const sol = solutions.value.find(s => s.id === activeFilter.value)
  if (!sol) return null
  return new Set(sol.stepIds)
})

const activeSolution = computed(() => {
  if (activeFilter.value === null) return null
  return solutions.value.find(s => s.id === activeFilter.value) ?? null
})

const caseId = Number(route.params.id)

const isOwner = computed(() =>
  Boolean(errorCase.value && authStore.user && errorCase.value.ownerUserId === authStore.user.userId),
)

/**
 * Adding steps/solutions — mirrors core-api `ErrorCaseAccess.requireWrite`: the author, or a
 * WRITE/ADMIN member when the case is workspace-visible. Personal cases stay author-only.
 */
const canWriteContent = computed(() => {
  const c = errorCase.value
  if (!c || !authStore.user) return false
  if (isOwner.value) return true
  if (c.visibility !== 'WORKSPACE' || c.workspaceId == null) return false
  const role = teamStore.workspaces.find(w => w.workspaceId === c.workspaceId)?.role
  return role === 'ADMIN' || role === 'WRITE'
})

// Editing/deleting the case itself is owner-only in core-api (UpdateErrorCaseUseCase /
// DeleteErrorCaseUseCase check ownerUserId), so don't offer it to anyone else.
const canEditCase = isOwner

const stepIndexMap = computed(() => {
  const m = new Map<number, number>()
  steps.value.forEach((s, i) => m.set(s.id, i))
  return m
})

async function loadData() {
  loading.value = true
  try {
    const [errRes, stepsRes, solRes, commRes] = await Promise.all([
      errorApi.get(caseId),
      stepApi.list(caseId),
      solutionApi.list(caseId),
      commentApi.list(caseId, { sort: 'OLDEST' }),
    ])
    errorCase.value = errRes.data
    watching.value = errRes.data.watchedByMe ?? false // 별(Watch) 상태를 응답에서 초기화
    meTooCount.value = errRes.data.meToo?.count ?? 0
    meTooTagged.value = errRes.data.meToo?.taggedByMe ?? false
    steps.value = stepsRes.data
    solutions.value = solRes.data
    comments.value = commRes.data.items
    commentAuthorDirectory.value = commRes.data.authors ?? []
  } finally {
    loading.value = false
  }
  loadPublishState()
}

// 소유자 케이스의 발행 여부 조회. 404 = 미발행. 비소유자는 아예 호출하지 않는다.
async function loadPublishState() {
  if (!isOwner.value) { pubLoaded.value = true; return }
  try {
    const { data } = await publishmentApi.getByCase(caseId)
    publishment.value = data
  } catch (e) {
    if (!axios.isAxiosError(e) || e.response?.status !== 404) { /* 일시 오류는 조용히 무시 */ }
    publishment.value = null
  } finally {
    pubLoaded.value = true
  }
}

function onPublished(detail: PublishmentDetail) {
  publishment.value = detail // 트리거 → 상태 바로 전환
}

// Watchlist / notification deep links land on /error-cases/{id}#{step|solution|comment}-{id} —
// once the timeline is rendered, scroll to the referenced item and flash it briefly.
async function scrollToHash() {
  if (!route.hash) return
  await nextTick()
  const m = route.hash.match(/^#(step|solution|comment)-(\d+)$/)
  let el: Element | null = null
  if (m) {
    const [, kind, id] = m
    if (kind === 'step') el = document.querySelector(`[data-step-id="${id}"]`)
    else if (kind === 'solution') el = document.querySelector(`[data-solution-id="${id}"]`)
    else el = document.getElementById(`comment-${id}`)
  }
  el ||= document.getElementById(route.hash.slice(1))
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('anchor-flash')
  setTimeout(() => el?.classList.remove('anchor-flash'), 1600)
}

const showResolveConfirm = ref(false)
const showDeleteConfirm = ref(false)

// ── Watchlist toggle (FR-007) — reflects state immediately ──
const watching = ref(false)
const watchBusy = ref(false)

async function toggleWatch() {
  if (watchBusy.value) return
  watchBusy.value = true
  const next = !watching.value
  watching.value = next // reflect immediately
  try {
    if (next) {
      await meApi.addWatchlist(caseId)
    } else {
      await meApi.removeWatchlist(caseId)
    }
  } catch {
    watching.value = !next // revert on failure
  } finally {
    watchBusy.value = false
  }
}

// ── "나도 겪었어요"(me-too) ──
const meTooCount = ref(0)
const meTooTagged = ref(false)
const meTooBusy = ref(false)
const meTooBurst = ref(false) // 좋아요 터지듯 중앙 팝 애니메이션 표시 여부
let meTooBurstTimer: ReturnType<typeof setTimeout> | undefined

// 켤 때마다 애니메이션을 재시작 — 껐다가 다음 프레임에 켬.
function triggerMeTooBurst() {
  meTooBurst.value = false
  clearTimeout(meTooBurstTimer)
  requestAnimationFrame(() => {
    meTooBurst.value = true
    meTooBurstTimer = setTimeout(() => { meTooBurst.value = false }, 760)
  })
}

async function toggleMeToo() {
  // 본인 케이스에는 누를 수 없음(서버도 403). 낙관적 반영 후 서버 응답으로 확정.
  if (meTooBusy.value || isOwner.value) return
  meTooBusy.value = true
  const next = !meTooTagged.value
  meTooTagged.value = next
  meTooCount.value += next ? 1 : -1
  if (next) triggerMeTooBurst()
  try {
    const { data } = next ? await errorApi.markMeToo(caseId) : await errorApi.unmarkMeToo(caseId)
    meTooTagged.value = data.taggedByMe
    meTooCount.value = data.count
  } catch {
    meTooTagged.value = !next
    meTooCount.value += next ? -1 : 1
  } finally {
    meTooBusy.value = false
  }
}

async function deleteCase() {
  await errorApi.delete(caseId)
  router.push({ name: 'errorList', params: { slug: teamStore.currentSlug } })
}

async function addStep(v: StepFormValues) {
  const res = await stepApi.create(caseId, {
    title: v.title,
    status: v.status,
    attemptType: v.attemptType ?? undefined,
    body: v.body || undefined,
    insight: v.insight || undefined,
  })
  steps.value.push(res.data.step)
  if (errorCase.value) {
    errorCase.value.status = res.data.caseStatus
  }
  if (res.data.suggestResolve && errorCase.value && errorCase.value.status !== 'RESOLVED') {
    showResolveConfirm.value = true
  }
}

// Empty strings are meaningful on update — they clear the field — so send them as-is
// rather than dropping them the way the create path does.
async function updateStep(stepId: number, v: StepFormValues) {
  const res = await stepApi.update(caseId, stepId, {
    title: v.title,
    status: v.status,
    attemptType: v.attemptType,
    clearAttemptType: v.attemptType === null,
    body: v.body,
    insight: v.insight,
  })
  const i = steps.value.findIndex(s => s.id === stepId)
  if (i !== -1) steps.value[i] = res.data.step
  if (errorCase.value) errorCase.value.status = res.data.caseStatus
}

async function deleteStep(stepId: number) {
  await stepApi.delete(caseId, stepId)
  steps.value = steps.value.filter(s => s.id !== stepId)
  selectedStepIds.value.delete(stepId)
  // a solution that referenced it may now be stale
  solutions.value = solutions.value.filter(sol => !sol.stepIds.includes(stepId))
  if (activeFilter.value != null && !solutions.value.some(sol => sol.id === activeFilter.value)) {
    activeFilter.value = null
  }
}

async function confirmResolve() {
  await errorApi.update(caseId, { status: 'RESOLVED' })
  if (errorCase.value) {
    errorCase.value.status = 'RESOLVED'
  }
  showResolveConfirm.value = false
}

function toggleStepSelection(id: number) {
  if (selectedStepIds.value.has(id)) {
    selectedStepIds.value.delete(id)
  } else {
    selectedStepIds.value.add(id)
  }
  selectedStepIds.value = new Set(selectedStepIds.value)
}

async function createSolution(title: string) {
  const res = await solutionApi.create(caseId, {
    title,
    stepIds: [...selectedStepIds.value],
  })
  solutions.value.push(res.data)
  selectionMode.value = false
  selectedStepIds.value = new Set()
}

// ── Quote on text selection ──
const pendingQuote = ref<QuoteInfo | null>(null)
const quotePopup = ref<{ x: number; y: number } | null>(null)
let pendingQuoteData: { kind: 'CASE_BODY' | 'STEP'; sourceId: number | null; snapshot: string; label: string } | null = null

function onMouseUp() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.toString().trim()) {
    quotePopup.value = null
    return
  }

  const text = sel.toString().trim().slice(0, 500)
  const anchor = sel.anchorNode?.parentElement
  if (!anchor) { quotePopup.value = null; return }

  const contextEl = anchor.closest('[data-quote-context]')
  const stepEl = anchor.closest('[data-step-id]')

  if (stepEl) {
    const stepId = Number(stepEl.getAttribute('data-step-id'))
    const idx = stepIndexMap.value.get(stepId)
    pendingQuoteData = { kind: 'STEP', sourceId: stepId, snapshot: text, label: `Step ${idx != null ? idx + 1 : '?'}` }
  } else if (contextEl) {
    pendingQuoteData = { kind: 'CASE_BODY', sourceId: null, snapshot: text, label: 'Context' }
  } else {
    quotePopup.value = null
    return
  }

  const range = sel.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  quotePopup.value = { x: rect.left + rect.width / 2, y: rect.top }
}

function applyQuote() {
  if (pendingQuoteData) {
    pendingQuote.value = pendingQuoteData
    pendingQuoteData = null
  }
  quotePopup.value = null
  window.getSelection()?.removeAllRanges()
  const commentSection = document.getElementById('comment-section')
  commentSection?.scrollIntoView({ behavior: 'smooth', block: 'end' })
}

function clearQuote() {
  pendingQuote.value = null
}

// ── Comment actions ──
async function postComment(body: string, quote: QuoteInfo | null) {
  const res = await commentApi.create(caseId, {
    body,
    quoteSourceKind: quote?.kind ?? 'NONE',
    quoteSourceId: quote?.sourceId ?? null,
    quoteSnapshot: quote?.snapshot ?? null,
  })
  comments.value.push(res.data)
  pendingQuote.value = null
}

async function postReply(parentId: number, body: string, quote: QuoteInfo | null) {
  const res = await commentApi.create(caseId, {
    body,
    parentCommentId: parentId,
    quoteSourceKind: quote?.kind ?? 'NONE',
    quoteSourceId: quote?.sourceId ?? null,
    quoteSnapshot: quote?.snapshot ?? null,
  })
  function addReply(list: Comment[]): boolean {
    for (const c of list) {
      if (c.id === parentId) {
        if (!c.replies) c.replies = []
        c.replies.push(res.data)
        return true
      }
      if (c.replies?.length && addReply(c.replies)) return true
    }
    return false
  }
  addReply(comments.value)
}

async function editComment(commentId: number, body: string) {
  await commentApi.update(caseId, commentId, body)
  function update(list: Comment[]): boolean {
    for (const c of list) {
      if (c.id === commentId) { c.body = body; c.editedAt = new Date().toISOString(); return true }
      if (c.replies?.length && update(c.replies)) return true
    }
    return false
  }
  update(comments.value)
}

async function deleteComment(commentId: number) {
  await commentApi.delete(caseId, commentId)
  function markDeleted(list: Comment[]): boolean {
    for (const c of list) {
      if (c.id === commentId) { c.deletedAt = new Date().toISOString(); return true }
      if (c.replies?.length && markDeleted(c.replies)) return true
    }
    return false
  }
  markDeleted(comments.value)
}

async function toggleHelpful(commentId: number) {
  const res = await commentApi.toggleHelpful(caseId, commentId)
  // The response only carries userIds. core-api resolves names for everyone referenced when
  // the thread loads, but my own id can appear here for the first time — add myself so the
  // popover doesn't fall back to "알 수 없는 사용자" until a reload.
  const me = authStore.user
  if (me && !commentAuthorDirectory.value.some(a => a.userId === me.userId)) {
    commentAuthorDirectory.value = [
      ...commentAuthorDirectory.value,
      { userId: me.userId, handle: me.handle ?? null, displayName: me.displayName, avatarUrl: me.avatarUrl ?? null },
    ]
  }
  function update(list: Comment[]): boolean {
    for (const c of list) {
      if (c.id === commentId) {
        c.helpful = { count: res.data.count, userIds: res.data.userIds, helpedByMe: res.data.helpedByMe }
        return true
      }
      if (c.replies?.length && update(c.replies)) return true
    }
    return false
  }
  update(comments.value)
}

function scrollToQuote(kind: string, sourceId: number | null) {
  if (kind === 'CASE_BODY') {
    document.querySelector('[data-quote-context]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } else if (kind === 'STEP' && sourceId != null) {
    document.querySelector(`[data-step-id="${sourceId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

onMounted(async () => {
  await loadData()
  document.addEventListener('mouseup', onMouseUp)
  scrollToHash()
})
onUnmounted(() => {
  document.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <LoadingSpinner v-if="loading" size="lg" />

  <div v-else-if="errorCase" class="max-w-3xl mx-auto">
    <!-- me-too 중앙 팝 애니메이션 (좋아요 터지듯 손바닥 아이콘) -->
    <div v-if="meTooBurst" class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div class="metoo-burst">
        <span class="metoo-ring" />
        <HandSolidIcon class="metoo-ic" />
      </div>
    </div>

    <div class="text-center mb-12">
      <ErrorStatusBadge :status="errorCase.status" class="mb-6" />

      <h1 class="serif-title text-3xl md:text-4xl leading-tight text-zinc-900 dark:text-zinc-100 mb-6">
        {{ errorCase.title }}
      </h1>

      <div class="flex justify-center items-center gap-4 text-sm text-zinc-500 border-t border-b border-zinc-200 dark:border-zinc-800 py-4 flex-wrap">
        <span>{{ formatAbsolute(errorCase.createdAt) }}</span>
        <template v-if="errorCase.project">
          <span class="w-1 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
          <span>{{ errorCase.project }}</span>
        </template>
        <template v-if="errorCase.tags?.length">
          <span class="w-1 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
          <span>{{ errorCase.tags.join(', ') }}</span>
        </template>
      </div>

      <div class="mt-6 flex items-center justify-center gap-5">
        <button
          class="inline-flex items-center gap-1 text-xs transition-colors disabled:opacity-50"
          :class="watching ? 'text-amber-500 hover:text-amber-600' : 'text-zinc-400 hover:text-amber-500'"
          :disabled="watchBusy"
          :aria-pressed="watching"
          :title="watching ? 'Remove from watchlist' : 'Add to watchlist'"
          @click="toggleWatch"
        >
          <component :is="watching ? StarSolidIcon : StarOutlineIcon" class="w-3.5 h-3.5" />
          {{ watching ? 'Watching' : 'Watch' }}
        </button>

        <!-- Me too — 방문자는 토글, 본인 케이스는 카운트만 표시 -->
        <button
          v-if="!isOwner"
          class="inline-flex items-center gap-1 text-xs transition-colors disabled:opacity-50"
          :class="meTooTagged ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400'"
          :disabled="meTooBusy"
          :aria-pressed="meTooTagged"
          :title="meTooTagged ? '“나도 겪었어요” 해제' : '나도 겪었어요'"
          @click="toggleMeToo"
        >
          <component :is="meTooTagged ? HandSolidIcon : HandOutlineIcon" class="w-3.5 h-3.5" />
          Me too <span class="tabular-nums">· {{ meTooCount }}</span>
        </button>
        <span
          v-else
          class="inline-flex items-center gap-1 text-xs text-zinc-400"
          title="본인 케이스에는 누를 수 없어요"
        >
          <HandOutlineIcon class="w-3.5 h-3.5" />
          Me too <span class="tabular-nums">· {{ meTooCount }}</span>
        </span>

        <!-- 소유자 발행 상태: 미발행이면 발행 트리거, 발행됨이면 Published(초록)/Offline(회색) 표시.
             실제 조작(내리기/다시공개)은 하단 상태 바에서 한다(참조 publish-case-status-v1).
             순서상 Watch·Me too 와 Edit·Delete 사이(가운데)에 둔다. -->
        <template v-if="isOwner && pubLoaded">
          <!-- 게스트(데모)는 공개 발행 불가 — 서버도 403. 발행 트리거를 숨긴다. -->
          <button
            v-if="!publishment && !authStore.isGuest"
            class="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
            @click="showPublishSheet = true"
          >
            <LinkIcon class="w-3.5 h-3.5" />
            Publish
          </button>
          <span
            v-else-if="publishment"
            class="inline-flex items-center gap-1 text-xs"
            :class="publishment.status === 'LIVE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'"
            :title="publishment.status === 'LIVE' ? '발행됨 — 하단 바에서 관리' : '내려짐 — 하단 바에서 다시 공개'"
          >
            <LinkIcon class="w-3.5 h-3.5" />
            {{ publishment.status === 'LIVE' ? 'Published' : 'Offline' }}
          </span>
        </template>

        <button
          v-if="canEditCase"
          class="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors"
          @click="router.push({ name: 'errorEdit', params: { slug: teamStore.currentSlug, id: caseId } })"
        >Edit</button>
        <button
          v-if="canEditCase"
          class="text-xs text-zinc-400 hover:text-rose-500 transition-colors"
          @click="showDeleteConfirm = true"
        >Delete</button>
      </div>
    </div>

    <div class="space-y-10 mb-12" data-tour="context">
      <div v-if="errorCase.description" data-quote-context>
        <h3 class="font-bold text-zinc-800 dark:text-zinc-200 mb-3">Context</h3>
        <BodyRenderer
          :content="errorCase.description"
          :snippets="errorCase.snippets"
          :attachments="errorCase.attachments"
        />
      </div>

      <div v-if="errorCase.snapshot?.rawPaste" data-quote-context>
        <pre class="bg-zinc-100 dark:bg-zinc-900/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800/50 font-mono text-xs text-rose-500 dark:text-rose-300 leading-relaxed overflow-x-auto themed-scroll whitespace-pre-wrap">{{ errorCase.snapshot.rawPaste }}</pre>
      </div>

      <!-- 본문에 삽입하지 않았지만 케이스에 붙은 첨부·스니펫 -->
      <UntaggedAssets
        :attachments="errorCase.attachments"
        :snippets="errorCase.snippets"
        :body="errorCase.description"
      />
    </div>

    <section class="mb-12" data-tour="timeline">
      <div class="flex items-center justify-between mb-6 border-b border-zinc-200 dark:border-zinc-800/50 pb-4 pt-8">
        <h3 class="font-bold text-zinc-800 dark:text-zinc-200">Resolution Timeline</h3>
        <SolutionSelector
          v-if="canWriteContent"
          :selected-count="selectedStepIds.size"
          :active="selectionMode"
          @toggle="selectionMode = !selectionMode"
          @create="createSolution"
        />
      </div>

      <div v-if="solutions.length" class="flex items-center gap-4 mb-6">
        <button
          class="pb-1 text-xs font-medium uppercase tracking-widest transition-colors"
          :class="activeFilter === null
            ? 'text-zinc-800 dark:text-zinc-100 border-b-2 border-zinc-800 dark:border-zinc-100'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border-b-2 border-transparent'"
          @click="activeFilter = null"
        >
          All Steps
        </button>
        <button
          v-for="sol in solutions"
          :key="sol.id"
          class="pb-1 text-xs font-medium uppercase tracking-widest transition-colors flex items-center gap-1.5"
          :class="activeFilter === sol.id
            ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 border-b-2 border-transparent'"
          @click="activeFilter = sol.id"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {{ sol.title }}
        </button>
      </div>

      <TimelineList
        :steps="steps"
        :solutions="activeSolution ? [activeSolution] : []"
        :selection-mode="selectionMode"
        :selected-ids="selectedStepIds"
        :highlighted-ids="highlightedStepIds"
        :viewer-user-id="authStore.user?.userId ?? null"
        @toggle="toggleStepSelection"
        @update="updateStep"
        @delete="deleteStep"
      />
      <StepForm v-if="canWriteContent" @submit="addStep" />
    </section>

    <section id="comment-section" class="mb-8">
      <div class="border-t border-zinc-200 dark:border-zinc-800 pt-8 mb-6">
        <h3 class="font-bold text-zinc-800 dark:text-zinc-200 mb-1">Discussion</h3>
        <p class="text-xs text-zinc-400 dark:text-zinc-600">{{ comments.length }} comment{{ comments.length !== 1 ? 's' : '' }}</p>
      </div>

      <CommentThread
        v-if="comments.length"
        :comments="comments"
        :case-id="caseId"
        :case-owner-user-id="errorCase.ownerUserId"
        :step-index-map="stepIndexMap"
        :author-map="commentAuthorMap"
        @reply="postReply"
        @edit="editComment"
        @delete="deleteComment"
        @helpful="toggleHelpful"
        @scroll-to-quote="scrollToQuote"
      />

      <div class="mt-6">
        <CommentForm
          :quote="pendingQuote"
          :case-id="caseId"
          @submit="postComment"
          @clear-quote="clearQuote"
        />
      </div>
    </section>

    <Teleport to="body">
      <QuotePopup
        v-if="quotePopup"
        :x="quotePopup.x"
        :y="quotePopup.y"
        @quote="applyQuote"
      />
      <div v-if="showResolveConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div class="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
          <h3 class="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-2">Mark as Resolved?</h3>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-5 leading-relaxed">
            A step was marked as resolved. Would you like to update this error case's status to Resolved as well?
          </p>
          <div class="flex justify-end gap-2">
            <button class="px-4 py-1.5 text-xs font-medium rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 transition-colors" @click="showResolveConfirm = false">Cancel</button>
            <button class="px-4 py-1.5 text-xs font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors" @click="confirmResolve">Confirm</button>
          </div>
        </div>
      </div>
      <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div class="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
          <h3 class="text-sm font-semibold text-zinc-800 dark:text-zinc-100 mb-2">Delete Error Case?</h3>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-5 leading-relaxed">
            This will permanently delete this error case and all associated steps, solutions, snippets, and attachments. This action cannot be undone.
          </p>
          <div class="flex justify-end gap-2">
            <button class="px-4 py-1.5 text-xs font-medium rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 transition-colors" @click="showDeleteConfirm = false">Cancel</button>
            <button class="px-4 py-1.5 text-xs font-medium rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors" @click="deleteCase">Delete</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 발행된 소유자 케이스에만 상태 바. 미발행이면 위 Publish 트리거가 대신 노출된다.
         바에서 내리기/다시공개 시 status 를 액션행 라벨에 반영하려고 update 를 받는다. -->
    <PublishStatusBar v-if="isOwner && publishment" :detail="publishment" @update="publishment = $event" @deleted="publishment = null" />

    <!-- 발행물 생성 시트 (하단 슬라이드업) -->
    <PublishSheet
      v-if="showPublishSheet"
      :case-id="errorCase.id"
      :case-title="errorCase.title"
      :case-summary="null"
      :case-description="errorCase.description ?? null"
      :steps="steps"
      :solutions="solutions"
      :attachments="errorCase.attachments"
      :author-default="authStore.user?.displayName ?? ''"
      @published="onPublished"
      @close="showPublishSheet = false"
    />
  </div>
</template>

<style scoped>
/* me-too 중앙 팝 — 손바닥 아이콘이 팡 튀며 그린 링이 퍼짐 */
.metoo-burst {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.metoo-ring {
  position: absolute;
  width: 120px;
  height: 120px;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.34) 0%, transparent 62%);
  animation: metoo-ringpop 0.62s ease-out forwards;
}
.metoo-ic {
  width: 96px;
  height: 96px;
  color: #059669;
  filter: drop-shadow(0 6px 16px rgba(5, 150, 105, 0.45));
  animation: metoo-pawpop 0.72s cubic-bezier(0.2, 1.3, 0.4, 1) forwards;
}
:global(.dark) .metoo-ic {
  color: #34d399;
}
@keyframes metoo-pawpop {
  0% { transform: scale(0.3) rotate(-12deg); opacity: 0; }
  18% { opacity: 1; }
  45% { transform: scale(1.18) rotate(4deg); opacity: 1; }
  68% { transform: scale(1) rotate(0); opacity: 1; }
  100% { transform: scale(1.12); opacity: 0; }
}
@keyframes metoo-ringpop {
  0% { transform: scale(0.2); opacity: 0.9; }
  70% { opacity: 0.5; }
  100% { transform: scale(1.7); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  /* 0.01ms 로 줄이면 키프레임 끝 프레임(opacity:0)으로 즉시 점프해 팝이 아예 안 보인다.
     애니메이션만 끄고 정적 상태(opacity:1)로 잠깐 띄운 뒤, JS 760ms 타이머가 제거한다. */
  .metoo-ic, .metoo-ring { animation: none; }
}
</style>
