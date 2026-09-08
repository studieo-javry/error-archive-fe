<script setup lang="ts">
import { ref, nextTick, onBeforeUnmount } from 'vue'
import type { QuoteSourceKind, MentionCandidate } from '@/types/error'
import { commentApi } from '@/services/commentApi'

export interface QuoteInfo {
  kind: QuoteSourceKind
  sourceId: number | null
  snapshot: string
  label: string
}

const props = defineProps<{
  quote?: QuoteInfo | null
  initialBody?: string
  placeholder?: string
  submitLabel?: string
  /** 멘션 자동완성용 케이스 ID. 없으면 멘션 비활성. */
  caseId?: number
}>()

const emit = defineEmits<{
  submit: [body: string, quote: QuoteInfo | null]
  cancel: []
  clearQuote: []
}>()

const body = ref(props.initialBody ?? '')
const textareaEl = ref<HTMLTextAreaElement | null>(null)

function onSubmit() {
  if (!body.value.trim()) return
  emit('submit', body.value, props.quote ?? null)
  body.value = ''
  emit('clearQuote')
}

// ── @멘션 자동완성 ──
// BE 와 동일하게 @ 앞이 문자열 시작/공백일 때만 멘션으로 인정(이메일·코드 안의 @ 보호).
const MENTION_RE = /(?:^|\s)@([A-Za-z0-9_.가-힣-]*)$/
const mentionOpen = ref(false)
const mentionItems = ref<MentionCandidate[]>([])
const mentionIndex = ref(0)
const mentionTokenStart = ref(-1) // 본문에서 '@' 의 위치
let fetchTimer: ReturnType<typeof setTimeout> | null = null
let fetchSeq = 0

function closeMention() {
  mentionOpen.value = false
  mentionItems.value = []
  mentionTokenStart.value = -1
  if (fetchTimer) { clearTimeout(fetchTimer); fetchTimer = null }
}

// 커서 바로 앞의 @토큰을 감지 → 후보 조회(디바운스).
function detectMention() {
  const el = textareaEl.value
  if (!el || props.caseId == null) return
  const caret = el.selectionStart ?? 0
  const upto = body.value.slice(0, caret)
  const m = upto.match(MENTION_RE)
  if (!m) { closeMention(); return }
  const q = m[1] // '@' 뒤 입력값(빈 문자열 가능)
  // '@' 위치 = 커서 - 입력값 길이 - 1('@' 자신). m[0] 의 선행 공백은 무시.
  mentionTokenStart.value = caret - q.length - 1

  if (fetchTimer) clearTimeout(fetchTimer)
  const seq = ++fetchSeq
  fetchTimer = setTimeout(async () => {
    if (props.caseId == null) return
    try {
      const { data } = await commentApi.mentionCandidates(props.caseId, q, 8)
      if (seq !== fetchSeq) return // 최신 요청만 반영
      mentionItems.value = data
      mentionIndex.value = 0
      // 빈 검색어인데 후보가 없으면 굳이 열지 않음.
      mentionOpen.value = data.length > 0 || q.length > 0
    } catch {
      closeMention()
    }
  }, 140)
}

function applyMention(idx: number) {
  const el = textareaEl.value
  const item = mentionItems.value[idx]
  if (!el || !item || mentionTokenStart.value < 0) return
  const caret = el.selectionStart ?? body.value.length
  // handle 을 삽입(BE 가 @handle 우선 해석). handle 이 없으면 displayName 으로 폴백.
  const token = item.handle ?? item.displayName
  const before = body.value.slice(0, mentionTokenStart.value)
  const after = body.value.slice(caret)
  const insert = `@${token} `
  body.value = before + insert + after
  closeMention()
  nextTick(() => {
    const pos = before.length + insert.length
    el.focus()
    el.setSelectionRange(pos, pos)
  })
}

function onKeydown(e: KeyboardEvent) {
  if (!mentionOpen.value || mentionItems.value.length === 0) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    mentionIndex.value = (mentionIndex.value + 1) % mentionItems.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    mentionIndex.value = (mentionIndex.value - 1 + mentionItems.value.length) % mentionItems.value.length
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault()
    applyMention(mentionIndex.value)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    closeMention()
  }
}

// 캐럿이 움직였을 수 있으니 keyup 에서도 재감지하지만, 멘션 UI 를 조작하는 키는
// 건너뛴다. Esc 직후 재조회가 돌면 닫은 창이 다시 열리고, ↑↓ 로 옮긴 선택도
// 재조회가 mentionIndex 를 0 으로 되돌리기 때문.
function onKeyup(e: KeyboardEvent) {
  if (e.key === 'Escape') return
  if (mentionOpen.value && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Tab')) return
  detectMention()
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

// blur 시 닫되, 항목 클릭(mousedown)이 먼저 처리되도록 약간 지연.
function onBlur() {
  setTimeout(closeMention, 120)
}

onBeforeUnmount(() => { if (fetchTimer) clearTimeout(fetchTimer) })
</script>

<template>
  <div>
    <div v-if="quote" class="mb-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-zinc-800/60 border-l-2 border-emerald-400">
      <div class="flex-1 min-w-0">
        <span class="text-[10px] font-medium text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">{{ quote.label }}</span>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2 italic">"{{ quote.snapshot }}"</p>
      </div>
      <button class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs shrink-0" @click="$emit('clearQuote')">&times;</button>
    </div>
    <form class="flex gap-2 items-end" @submit.prevent="onSubmit">
      <div class="relative flex-1">
        <textarea
          ref="textareaEl"
          v-model="body"
          :placeholder="placeholder || 'Share your thoughts. Drag text from the body or steps to quote it.'"
          rows="2"
          class="w-full text-sm bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 transition-colors resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-800 dark:text-zinc-200"
          @input="detectMention"
          @keyup="onKeyup"
          @click="detectMention"
          @keydown="onKeydown"
          @blur="onBlur"
        />

        <!-- 멘션 드롭다운 (G안: 아바타 + 이름 + 배지 서브텍스트 + 우측 @handle) -->
        <div
          v-if="mentionOpen"
          class="absolute z-20 left-0 top-full mt-1 w-72 max-h-64 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg shadow-black/10 p-1"
        >
          <p v-if="mentionItems.length === 0" class="px-3 py-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            매칭되는 사용자 없음
          </p>
          <button
            v-for="(u, i) in mentionItems"
            :key="u.userId"
            type="button"
            class="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left transition-colors"
            :class="i === mentionIndex ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50'"
            @mouseenter="mentionIndex = i"
            @mousedown.prevent="applyMention(i)"
          >
            <img
              v-if="u.avatarUrl"
              :src="u.avatarUrl"
              :alt="u.displayName"
              class="w-6 h-6 rounded-full object-cover shrink-0"
            />
            <span
              v-else
              class="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-semibold text-white bg-gradient-to-br from-emerald-300 to-teal-300"
            >{{ initials(u.displayName) }}</span>
            <span class="min-w-0 flex-1 text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">{{ u.displayName }}</span>
            <span v-if="u.handle" class="shrink-0 text-[11px] font-normal text-zinc-400 dark:text-zinc-500">@{{ u.handle }}</span>
          </button>
        </div>
      </div>

      <div class="flex items-center gap-1.5 pb-1">
        <button
          v-if="initialBody"
          type="button"
          class="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          @click="$emit('cancel')"
        >Cancel</button>
        <button
          type="submit"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        >{{ submitLabel || 'Post' }}</button>
      </div>
    </form>
  </div>
</template>
