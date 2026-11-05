<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import type { QuoteSourceKind, MentionCandidate, MentionedUser } from '@/types/error'
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
  /** 수정 시 이미 걸려 있던 멘션 — 입력창에서도 굵게 보이게. */
  knownMentions?: MentionedUser[]
}>()

const emit = defineEmits<{
  submit: [body: string, quote: QuoteInfo | null]
  cancel: []
  clearQuote: []
}>()

const body = ref(props.initialBody ?? '')
// textarea 에 지금 보이는 글자 그대로 — 한글 조합 중엔 v-model(body)이 조합이 끝날 때까지 갱신되지 않아,
// 글자가 투명한 입력창에선 조합 중인 글자가 안 보였다. 표시 레이어·멘션 감지는 이 값을 쓴다.
const draft = ref(body.value)
watch(body, v => { draft.value = v })
const textareaEl = ref<HTMLTextAreaElement | null>(null)
const mirrorEl = ref<HTMLElement | null>(null)

function onSubmit() {
  if (!body.value.trim()) return
  emit('submit', body.value, props.quote ?? null)
  body.value = ''
  closeMention()
  emit('clearQuote')
}

// ── @멘션 자동완성 ──
// BE 와 동일하게 @ 앞이 문자열 시작/공백일 때만 멘션으로 인정(이메일·코드 안의 @ 보호).
const MENTION_RE = /(?:^|\s)@([A-Za-z0-9_.가-힣-]*)$/
const mentionOpen = ref(false)
const mentionItems = ref<MentionCandidate[]>([])
const mentionIndex = ref(0)
const mentionTokenStart = ref(-1) // 본문에서 '@' 의 위치
const mentionTokenEnd = ref(-1) // 검색어 끝(= 감지 시점 커서)
const mentionQuery = ref('') // '@' 뒤 입력값 — 빈 결과 안내 문구 구분용
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

// 드롭다운은 body 로 Teleport 한 fixed 레이어 — 페이지 스크롤 영역의 높이에 끼어들지 않게.
// textarea 아래 absolute 로 붙이면 맨 아래 댓글창에서 후보 수가 바뀔 때마다 스크롤 영역이
// 늘었다 줄며 화면이 혼자 움직였다. 아래 공간이 모자라면 위로 연다.
const DD_MAX_H = 256 // .mention-dd 의 max-height(16rem)
const DD_W = 288 // .mention-dd 의 width(18rem)
const DD_GAP = 6
const ddUp = ref(false)
const ddStyle = ref<Record<string, string>>({})
function positionDropdown() {
  const el = textareaEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const vh = window.innerHeight
  const below = vh - r.bottom - DD_GAP
  const above = r.top - DD_GAP
  ddUp.value = below < DD_MAX_H && above > below
  const room = Math.max(ddUp.value ? above : below, 0) - 8
  const left = Math.max(8, Math.min(r.left, window.innerWidth - DD_W - 8))
  ddStyle.value = {
    left: `${left}px`,
    maxHeight: `${Math.min(DD_MAX_H, room)}px`,
    ...(ddUp.value ? { bottom: `${vh - r.top + DD_GAP}px` } : { top: `${r.bottom + DD_GAP}px` }),
  }
}
// 열려 있는 동안엔 스크롤(안쪽 스크롤 영역 포함 → capture)·리사이즈에 위치를 따라간다.
watch(mentionOpen, open => {
  if (open) {
    window.addEventListener('scroll', positionDropdown, true)
    window.addEventListener('resize', positionDropdown)
  } else {
    window.removeEventListener('scroll', positionDropdown, true)
    window.removeEventListener('resize', positionDropdown)
  }
})

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
  mentionTokenEnd.value = -1
  if (fetchTimer) { clearTimeout(fetchTimer); fetchTimer = null }
}

// 커서 바로 앞의 @토큰을 감지 → 후보 조회(디바운스).
function detectMention() {
  const el = textareaEl.value
  if (!el || props.caseId == null) return
  const caret = el.selectionStart ?? 0
  const upto = el.value.slice(0, caret)
  const m = upto.match(MENTION_RE)
  if (!m) { closeMention(); return }
  const q = m[1] // '@' 뒤 입력값(빈 문자열 가능)
  // '@' 위치 = 커서 - 입력값 길이 - 1('@' 자신). m[0] 의 선행 공백은 무시.
  mentionTokenStart.value = caret - q.length - 1
  mentionTokenEnd.value = caret

  if (fetchTimer) clearTimeout(fetchTimer)
  const seq = ++fetchSeq
  fetchTimer = setTimeout(async () => {
    if (props.caseId == null) return
    try {
      const { data } = await commentApi.mentionCandidates(props.caseId, q, 8)
      if (seq !== fetchSeq) return // 최신 요청만 반영
      mentionItems.value = data
      mentionIndex.value = 0
      mentionQuery.value = q
      positionDropdown()
      // 빈 검색어에 후보가 없어도 연다 — 안 열면 멘션 기능이 없는 것처럼 보여 검색 안내를 띄운다.
      mentionOpen.value = true
    } catch {
      closeMention()
    }
  }, 140)
}

function onInput(e: Event) {
  draft.value = (e.target as HTMLTextAreaElement).value
  detectMention()
}

function applyMention(idx: number) {
  const el = textareaEl.value
  const item = mentionItems.value[idx]
  if (!el || !item || mentionTokenStart.value < 0) return
  const caret = el.selectionStart ?? el.value.length
  // handle 을 삽입(BE 가 @handle 우선 해석). handle 이 없으면 displayName 으로 폴백.
  const token = item.handle ?? item.displayName
  // body 가 아니라 화면의 값 — 한글 검색어(@홍길)를 조합 중에 골라도 잘리지 않게.
  const before = el.value.slice(0, mentionTokenStart.value)
  const after = el.value.slice(caret)
  const insert = `@${token} `
  knownTokens.value = new Set(knownTokens.value).add(token.toLowerCase())
  body.value = before + insert + after
  closeMention()
  nextTick(() => {
    const pos = before.length + insert.length
    el.focus()
    el.setSelectionRange(pos, pos)
  })
}

function onKeydown(e: KeyboardEvent) {
  if (!mentionOpen.value) return
  // 후보가 없는 안내 상태에서도 Esc 로 닫을 수 있어야 한다.
  if (e.key === 'Escape') {
    e.preventDefault()
    closeMention()
    return
  }
  if (mentionItems.value.length === 0) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    mentionIndex.value = (mentionIndex.value + 1) % mentionItems.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    mentionIndex.value = (mentionIndex.value - 1 + mentionItems.value.length) % mentionItems.value.length
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault()
    applyMention(mentionIndex.value)
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

// ── 입력창 표시 레이어 ──
// textarea 글자는 투명하게 두고 같은 글자를 뒤 레이어(mirror)에 그린다 — textarea 안에선 글자 일부만
// 꾸밀 수 없어서. 입력 중인 @검색어 는 회색 박스, 고른 멘션은 굵게(text-shadow 로 — 실제 굵기를 바꾸면
// 글자 폭이 달라져 커서 위치가 어긋난다).
const knownTokens = ref(new Set<string>())
watch(() => props.knownMentions, list => {
  const next = new Set(knownTokens.value)
  for (const m of list ?? []) {
    next.add(m.identifier.toLowerCase())
    if (m.handle) next.add(m.handle.toLowerCase())
  }
  knownTokens.value = next
}, { immediate: true })

const MIRROR_MENTION = /(^|\s)@([A-Za-z0-9_.가-힣-]+)/g
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
// 아는 멘션 중 가장 긴 표기 — 뒤에 영숫자가 이어지면 다른 단어(BE 규칙과 같음).
function knownLength(word: string): number {
  const w = word.toLowerCase()
  let best = 0
  for (const k of knownTokens.value) {
    if (k.length > best && w.startsWith(k) && !/[a-z0-9]/i.test(word.charAt(k.length))) best = k.length
  }
  return best
}
const mirrorHtml = computed(() => {
  const v = draft.value
  const marks: [number, number, string][] = []
  const tokStart = mentionTokenStart.value
  for (const m of v.matchAll(MIRROR_MENTION)) {
    const s = m.index! + m[1].length
    if (s === tokStart) continue
    const len = knownLength(m[2])
    if (len) marks.push([s, s + 1 + len, 'mx-mention'])
  }
  if (tokStart >= 0 && mentionTokenEnd.value > tokStart) marks.push([tokStart, mentionTokenEnd.value, 'mx-token'])
  marks.sort((a, b) => a[0] - b[0])
  let html = ''
  let pos = 0
  for (const [s, e, cls] of marks) {
    if (s < pos) continue
    html += `${escapeHtml(v.slice(pos, s))}<span class="${cls}">${escapeHtml(v.slice(s, e))}</span>`
    pos = e
  }
  // 끝의 빈 줄도 높이를 갖게 폭 없는 글자를 붙인다.
  return html + escapeHtml(v.slice(pos)) + '\u200b'
})
function syncMirrorScroll() {
  if (mirrorEl.value && textareaEl.value) mirrorEl.value.scrollTop = textareaEl.value.scrollTop
}
watch(mirrorHtml, () => nextTick(syncMirrorScroll))

function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

// blur 시 닫되, 항목 클릭(mousedown)이 먼저 처리되도록 약간 지연.
function onBlur() {
  setTimeout(closeMention, 120)
}

onBeforeUnmount(() => {
  if (fetchTimer) clearTimeout(fetchTimer)
  window.removeEventListener('scroll', positionDropdown, true)
  window.removeEventListener('resize', positionDropdown)
})
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
        <!-- 표시 레이어: textarea 와 같은 테두리 두께·여백·글꼴이어야 줄바꿈 위치가 같다 -->
        <div
          ref="mirrorEl"
          aria-hidden="true"
          class="mention-mirror absolute inset-0 text-sm border border-transparent rounded-lg px-3 py-2 overflow-hidden pointer-events-none whitespace-pre-wrap break-words text-zinc-800 dark:text-zinc-200"
          v-html="mirrorHtml"
        />
        <textarea
          ref="textareaEl"
          v-model="body"
          :placeholder="placeholder || 'Share your thoughts. Drag text from the body or steps to quote it.'"
          rows="2"
          class="relative block w-full text-sm bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 transition-colors resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-transparent caret-zinc-800 dark:caret-zinc-200 selection:bg-emerald-500/25 selection:text-transparent"
          @scroll="syncMirrorScroll"
          @input="onInput"
          @keyup="onKeyup"
          @click="detectMention"
          @keydown="onKeydown"
          @blur="onBlur"
        />

        <!-- 멘션 드롭다운 (Glass — 반투명 blur + 미끄러지는 하이라이트 + 소프트 아바타) -->
        <Teleport to="body">
        <Transition name="mention">
          <div v-if="mentionOpen" class="mention-dd" :class="{ up: ddUp }" :style="ddStyle">
            <p v-if="mentionItems.length === 0" class="mention-empty">{{ mentionQuery ? '매칭되는 사용자 없음' : '이름을 입력해 검색하세요' }}</p>
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
        </Teleport>
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
  position: fixed; z-index: 60;
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
/* 입력창 표시 레이어 — 입력 중인 @검색어 회색 박스, 고른 멘션은 굵게 */
.mention-mirror { --mx-ink: #18181b; --mx-box: rgba(24, 24, 27, .075); }
.dark .mention-mirror { --mx-ink: #f4f4f5; --mx-box: rgba(255, 255, 255, .11); }
.mx-token { color: var(--mx-ink); background: var(--mx-box); border-radius: 4px; box-shadow: 0 0 0 2px var(--mx-box); }
.mx-mention { color: var(--mx-ink); text-shadow: .35px 0 0 var(--mx-ink), -.35px 0 0 var(--mx-ink); }
/* 팝인 트랜지션(스프링) */
.mention-enter-active { transition: opacity .28s ease, transform .34s cubic-bezier(.22, 1.2, .36, 1); }
.mention-leave-active { transition: opacity .15s ease, transform .15s ease; }
.mention-enter-from { opacity: 0; transform: translateY(8px) scale(.96); }
.mention-leave-to { opacity: 0; transform: translateY(4px) scale(.98); }
/* 위로 열릴 땐 방향을 뒤집어 입력창 쪽으로 다가오게 */
.mention-dd.up { transform-origin: bottom left; }
.mention-dd.up.mention-enter-from { transform: translateY(-8px) scale(.96); }
.mention-dd.up.mention-leave-to { transform: translateY(-4px) scale(.98); }
@media (prefers-reduced-motion: reduce) {
  .mention-pill, .mrow.on .mav, .mname { transition: none; animation: none; }
}
</style>
