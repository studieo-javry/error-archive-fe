<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { formatAbsolute } from '@/utils/timeAgo'
import { useRoute, useRouter } from 'vue-router'
import { errorApi } from '@/services/errorApi'
import { meApi } from '@/services/meApi'
import { useTeamStore } from '@/stores/teamStore'
import { stepApi } from '@/services/stepApi'
import { solutionApi } from '@/services/solutionApi'
import { commentApi } from '@/services/commentApi'
import type { ErrorCaseDetail, Step, Solution, StepCreateRequest, Comment } from '@/types/error'
import ErrorStatusBadge from '@/components/error/ErrorStatusBadge.vue'
import TimelineList from '@/components/timeline/TimelineList.vue'
import StepForm from '@/components/timeline/StepForm.vue'
import SolutionSelector from '@/components/timeline/SolutionSelector.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import BodyRenderer from '@/components/common/BodyRenderer.vue'
import CommentThread from '@/components/comment/CommentThread.vue'
import CommentForm from '@/components/comment/CommentForm.vue'
import QuotePopup from '@/components/comment/QuotePopup.vue'
import type { QuoteInfo } from '@/components/comment/CommentForm.vue'
import { StarIcon as StarOutlineIcon } from '@heroicons/vue/24/outline'
import { StarIcon as StarSolidIcon } from '@heroicons/vue/24/solid'

const route = useRoute()
const router = useRouter()
const teamStore = useTeamStore()
const errorCase = ref<ErrorCaseDetail | null>(null)
const steps = ref<Step[]>([])
const solutions = ref<Solution[]>([])
const comments = ref<Comment[]>([])
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
    steps.value = stepsRes.data
    solutions.value = solRes.data
    comments.value = commRes.data.items
  } finally {
    loading.value = false
  }
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

async function deleteCase() {
  await errorApi.delete(caseId)
  router.push({ name: 'errorList', params: { slug: teamStore.currentSlug } })
}

async function addStep(data: StepCreateRequest) {
  const res = await stepApi.create(caseId, data)
  steps.value.push(res.data.step)
  if (errorCase.value) {
    errorCase.value.status = res.data.caseStatus
  }
  if (res.data.suggestResolve && errorCase.value && errorCase.value.status !== 'RESOLVED') {
    showResolveConfirm.value = true
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

      <div class="mt-6 flex items-center justify-center gap-3">
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
        <button
          class="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors"
          @click="router.push({ name: 'errorEdit', params: { slug: teamStore.currentSlug, id: caseId } })"
        >Edit</button>
        <button
          class="text-xs text-zinc-400 hover:text-rose-500 transition-colors"
          @click="showDeleteConfirm = true"
        >Delete</button>
      </div>
    </div>

    <div class="space-y-10 mb-12">
      <div v-if="errorCase.description" data-quote-context>
        <h3 class="font-bold text-zinc-800 dark:text-zinc-200 mb-3">Context</h3>
        <BodyRenderer
          :content="errorCase.description"
          :snippets="errorCase.snippets"
          :attachments="errorCase.attachments"
        />
      </div>

      <div v-if="errorCase.snapshot?.rawPaste" data-quote-context>
        <pre class="bg-zinc-100 dark:bg-zinc-900/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-800/50 font-mono text-xs text-rose-500 dark:text-rose-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">{{ errorCase.snapshot.rawPaste }}</pre>
      </div>
    </div>

    <section class="mb-12">
      <div class="flex items-center justify-between mb-6 border-b border-zinc-200 dark:border-zinc-800/50 pb-4 pt-8">
        <h3 class="font-bold text-zinc-800 dark:text-zinc-200">Resolution Timeline</h3>
        <SolutionSelector
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
        @toggle="toggleStepSelection"
      />
      <StepForm @submit="addStep" />
    </section>

    <section id="comment-section" class="mb-8">
      <div class="border-t border-zinc-200 dark:border-zinc-800 pt-8 mb-6">
        <h3 class="font-bold text-zinc-800 dark:text-zinc-200 mb-1">Discussion</h3>
        <p class="text-xs text-zinc-400 dark:text-zinc-600">{{ comments.length }} comment{{ comments.length !== 1 ? 's' : '' }}</p>
      </div>

      <CommentThread
        v-if="comments.length"
        :comments="comments"
        :case-owner-user-id="errorCase.ownerUserId"
        :step-index-map="stepIndexMap"
        @reply="postReply"
        @edit="editComment"
        @delete="deleteComment"
        @helpful="toggleHelpful"
        @scroll-to-quote="scrollToQuote"
      />

      <div class="mt-6">
        <CommentForm
          :quote="pendingQuote"
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
  </div>
</template>
