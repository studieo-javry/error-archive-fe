<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
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

// Glass 드롭다운: 활성 행 위로 미끄러지는 하이라이트(pill) 위치 계산.
const mentionListEl = ref<HTMLElement | null>(null)
const pillTransform = ref('translateY(0)')
const pillHeight = ref(0)
function positionPill() {
  const list = mentionListEl.value
  if (!list) return
  const rows = list.querySelectorAll<HTMLElement>('[data-mrow]')
  const row = rows[mentionIndex.value]
  if (!row) return
  pillTransform.value = `translateY(${row.offsetTop}px)`
  pillHeight.value = row.offsetHeight
}
watch([mentionIndex, mentionItems], () => nextTick(positionPill))

// 아바타 폴백 톤(이름 기반 안정적 선택) — 밤티한 그라데이션 대신 소프트 틴트.
function toneClass(u: MentionCandidate): string {
  const key = u.handle ?? u.displayName ?? ''
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return `mt${h % 6}`
}

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

        <!-- 멘션 드롭다운 (Glass — 반투명 blur + 미끄러지는 하이라이트 + 소프트 아바타) -->
        <Transition name="mention">
          <div v-if="mentionOpen" class="mention-dd">
            <p v-if="mentionItems.length === 0" class="mention-empty">매칭되는 사용자 없음</p>
            <div v-else ref="mentionListEl" class="mention-list">
              <div class="mention-pill" :style="{ transform: pillTransform, height: pillHeight + 'px' }" />
              <button
                v-for="(u, i) in mentionItems"
                :key="u.userId"
                data-mrow
                type="button"
                class="mrow"
                :class="{ on: i === mentionIndex }"
                @mouseenter="mentionIndex = i"
                @mousedown.prevent="applyMention(i)"
              >
                <img v-if="u.avatarUrl" :src="u.avatarUrl" :alt="u.displayName" class="mav" />
                <span v-else class="mav" :class="toneClass(u)">{{ initials(u.displayName) }}</span>
                <span class="mname">{{ u.displayName }}</span>
                <span v-if="u.handle" class="mhandle">{{ u.handle }}</span>
              </button>
            </div>
          </div>
        </Transition>
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

<!-- 멘션 드롭다운은 전역 <style> — 이 프로젝트는 scoped 의 :global(.dark) 가 빌드에서 누락돼
     다크가 안 먹는다(PublishStatusBar 와 동일 이슈). 전역 .dark 토큰은 app.css 처럼 정상 동작. -->
<style>
.mention-dd {
  --m-surface: rgba(255, 255, 255, .72);
  --m-line: rgba(0, 0, 0, .06);
  --m-tint: rgba(24, 24, 27, .06);
  --m-name: #52525b;
  --m-faint: #a1a1aa;
  --m-accent-ink: #047857;
  position: absolute; z-index: 20; left: 0; top: 100%; margin-top: 6px;
  width: 18rem; max-height: 16rem; overflow-y: auto;
  background: var(--m-surface);
  -webkit-backdrop-filter: blur(16px) saturate(1.5); backdrop-filter: blur(16px) saturate(1.5);
  border: 1px solid var(--m-line); border-radius: 14px;
  box-shadow: 0 12px 34px -6px rgba(24, 24, 27, .18), 0 2px 8px -3px rgba(24, 24, 27, .1);
  padding: 6px; transform-origin: top left;
}
.dark .mention-dd {
  --m-surface: rgba(39, 39, 42, .72);
  --m-line: rgba(255, 255, 255, .06);
  --m-tint: rgba(255, 255, 255, .08);
  --m-name: #d4d4d8; --m-faint: #71717a; --m-accent-ink: #6ee7b7;
  box-shadow: 0 14px 40px -6px rgba(0, 0, 0, .6), 0 2px 8px -3px rgba(0, 0, 0, .5);
}
.mention-empty { padding: 8px 12px; font-size: 11px; color: var(--m-faint); }
.mention-list { position: relative; }
.mention-pill {
  position: absolute; left: 0; right: 0; top: 0; z-index: 0; border-radius: 11px;
  background: var(--m-tint); pointer-events: none;
  transition: transform .42s cubic-bezier(.22, 1, .36, 1), height .42s cubic-bezier(.22, 1, .36, 1);
}
.mrow {
  position: relative; z-index: 1; display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 7px 11px; border-radius: 11px; text-align: left; background: none; border: 0; cursor: pointer;
}
.mav {
  flex-shrink: 0; width: 26px; height: 26px; border-radius: 9999px; overflow: hidden; object-fit: cover;
  display: grid; place-items: center; font-size: 10px; font-weight: 600; transition: transform .3s;
}
.mname {
  min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--m-name); font-size: .8125rem; font-weight: 400;
  transition: color .3s, transform .3s cubic-bezier(.22, 1, .36, 1);
}
.mhandle { flex-shrink: 0; font-size: 11.5px; color: var(--m-faint); transition: opacity .3s; }
.mhandle::before { content: "· "; color: var(--m-faint); }
.mrow:not(.on) .mhandle { opacity: .7; }
.mrow.on .mname { color: var(--m-accent-ink); font-weight: 500; transform: translateX(2px); }
@keyframes mAvPop { 0% { transform: scale(1); } 42% { transform: scale(1.16); } 100% { transform: scale(1); } }
.mrow.on .mav { animation: mAvPop .44s cubic-bezier(.34, 1.56, .64, 1); }
/* 소프트 아바타 톤 (그라데이션 대신 이름 기반 파스텔 틴트) */
.mt0 { background: rgba(13, 148, 136, .14); color: #0f766e; }
.mt1 { background: rgba(99, 102, 241, .14); color: #4f46e5; }
.mt2 { background: rgba(225, 29, 72, .12); color: #be123c; }
.mt3 { background: rgba(217, 119, 6, .16); color: #b45309; }
.mt4 { background: rgba(8, 145, 178, .14); color: #0e7490; }
.mt5 { background: rgba(147, 51, 234, .13); color: #7e22ce; }
.dark .mt0 { background: rgba(20, 184, 166, .17); color: #5eead4; }
.dark .mt1 { background: rgba(129, 140, 248, .19); color: #a5b4fc; }
.dark .mt2 { background: rgba(251, 113, 133, .17); color: #fda4af; }
.dark .mt3 { background: rgba(251, 191, 36, .17); color: #fcd34d; }
.dark .mt4 { background: rgba(34, 211, 238, .16); color: #67e8f9; }
.dark .mt5 { background: rgba(192, 132, 252, .17); color: #d8b4fe; }
/* 팝인 트랜지션(스프링) */
.mention-enter-active { transition: opacity .28s ease, transform .34s cubic-bezier(.22, 1.2, .36, 1); }
.mention-leave-active { transition: opacity .15s ease, transform .15s ease; }
.mention-enter-from { opacity: 0; transform: translateY(8px) scale(.96); }
.mention-leave-to { opacity: 0; transform: translateY(4px) scale(.98); }
@media (prefers-reduced-motion: reduce) {
  .mention-pill, .mrow.on .mav, .mname { transition: none; animation: none; }
}
</style>
