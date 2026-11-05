<script setup lang="ts">
import { ref, reactive, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/services/authApi'

/**
 * 댓글 본문의 멘션(a.mention)에 마우스를 올리면 잠시 뒤 뜨는 프로필 카드.
 * 멘션마다 컴포넌트를 두지 않고 댓글 영역(root) 하나에 이벤트를 걸어 카드 한 장을 옮겨 쓴다.
 * 마우스는 클릭하면 프로필로 이동, 터치는 첫 탭에 카드를 연다(hover 가 없으니).
 */
const props = defineProps<{
  root: HTMLElement | null
  /** 작성자별 이 케이스의 댓글 수 — 카드에 "이 케이스 댓글 N개". */
  commentCounts: Map<number, number>
}>()

const SHOW_DELAY = 320
const HIDE_DELAY = 140

const router = useRouter()
const authStore = useAuthStore()

const card = reactive({ uid: 0, name: '', handle: '', avatar: '' })
const visible = ref(false)
const pos = ref<Record<string, string>>({})
const cardEl = ref<HTMLElement | null>(null)
let current: HTMLElement | null = null
let showT: ReturnType<typeof setTimeout> | undefined
let hideT: ReturnType<typeof setTimeout> | undefined
let lastPointer = 'mouse'

// 팔로우 상태 — 같은 사람 카드를 다시 열 때 재조회하지 않게 캐시.
const followCache = new Map<number, boolean>()
const following = ref<boolean | null>(null)
const followBusy = ref(false)
const canFollow = ref(false)

function mentionOf(t: EventTarget | null): HTMLElement | null {
  const el = (t as HTMLElement | null)?.closest?.<HTMLElement>('a.mention[data-mention-uid]')
  return el && props.root?.contains(el) ? el : null
}

function place() {
  const a = current, el = cardEl.value
  if (!a || !el) return
  const r = a.getBoundingClientRect()
  const vw = window.innerWidth, vh = window.innerHeight
  const h = el.offsetHeight, w = el.offsetWidth
  let top = r.bottom + 8
  if (top + h > vh - 8) top = Math.max(8, r.top - h - 8)
  pos.value = { top: `${top}px`, left: `${Math.max(8, Math.min(r.left - 6, vw - w - 8))}px` }
}

async function loadFollow(uid: number) {
  if (followCache.has(uid)) { following.value = followCache.get(uid)!; return }
  following.value = null
  try {
    const { data } = await authApi.getFollowStatus(uid)
    followCache.set(uid, data.viewerFollowsTarget)
    if (card.uid === uid) following.value = data.viewerFollowsTarget
  } catch {
    if (card.uid === uid) canFollow.value = false
  }
}

function show(a: HTMLElement) {
  clearTimeout(showT); clearTimeout(hideT)
  current?.classList.remove('hot')
  current = a
  a.classList.add('hot')
  const d = a.dataset
  card.uid = Number(d.mentionUid)
  card.name = d.name ?? ''
  card.handle = d.handle ?? ''
  card.avatar = d.avatar ?? ''
  // 나 자신·게스트·비로그인은 팔로우 버튼 없음.
  canFollow.value = authStore.isAuthenticated && !authStore.isGuest && authStore.user?.userId !== card.uid
  if (canFollow.value) loadFollow(card.uid)
  visible.value = true
  nextTick(place)
}

function hide(now = false) {
  clearTimeout(showT); clearTimeout(hideT)
  const go = () => { visible.value = false; current?.classList.remove('hot'); current = null }
  if (now) go(); else hideT = setTimeout(go, HIDE_DELAY)
}

async function toggleFollow() {
  if (followBusy.value || following.value == null) return
  const uid = card.uid, next = !following.value
  followBusy.value = true
  try {
    if (next) await authApi.follow(uid); else await authApi.unfollow(uid)
    followCache.set(uid, next)
    if (card.uid === uid) following.value = next
  } finally {
    followBusy.value = false
  }
}

function openProfile() {
  const uid = card.uid
  hide(true)
  router.push({ name: 'profile', params: { id: String(uid) } })
}

// ── 댓글 영역 이벤트 위임 ──
function onOver(e: MouseEvent) {
  const a = mentionOf(e.target)
  if (!a || a.contains(e.relatedTarget as Node | null)) return
  clearTimeout(hideT); clearTimeout(showT)
  // 카드가 이미 떠 있으면 옆 멘션으로 옮길 땐 기다리지 않는다.
  if (current === a) return
  showT = setTimeout(() => show(a), current ? 0 : SHOW_DELAY)
}
function onOut(e: MouseEvent) {
  const a = mentionOf(e.target)
  if (!a || a.contains(e.relatedTarget as Node | null)) return
  hide()
}
function onPointerDown(e: PointerEvent) { lastPointer = e.pointerType }
function onClick(e: MouseEvent) {
  const a = mentionOf(e.target)
  if (!a) return
  // 수정키 클릭(새 탭)은 브라우저에 맡긴다.
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  e.preventDefault()
  if (lastPointer === 'touch' && current !== a) { show(a); return }
  hide(true)
  router.push({ name: 'profile', params: { id: a.dataset.mentionUid! } })
}
function onFocusIn(e: FocusEvent) {
  const a = mentionOf(e.target)
  if (a) show(a)
}
function onFocusOut(e: FocusEvent) {
  if (mentionOf(e.target) && !cardEl.value?.contains(e.relatedTarget as Node | null)) hide()
}
function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !visible.value) return
  const a = current
  hide(true)
  a?.focus()
}
function onScroll() { if (visible.value) hide(true) }
function onDocPointer(e: PointerEvent) {
  // 터치로 연 카드는 바깥을 누르면 닫는다.
  if (!visible.value) return
  const t = e.target as Node
  if (cardEl.value?.contains(t) || current?.contains(t)) return
  hide(true)
}

const ROOT_EVENTS = [
  ['mouseover', onOver], ['mouseout', onOut], ['pointerdown', onPointerDown],
  ['click', onClick], ['focusin', onFocusIn], ['focusout', onFocusOut],
] as const
function bind(el: HTMLElement | null, on: boolean) {
  if (!el) return
  for (const [type, fn] of ROOT_EVENTS) {
    if (on) el.addEventListener(type, fn as EventListener)
    else el.removeEventListener(type, fn as EventListener)
  }
}
watch(() => props.root, (el, prev) => { bind(prev ?? null, false); bind(el, true) }, { immediate: true })

document.addEventListener('keydown', onKey)
document.addEventListener('pointerdown', onDocPointer, true)
window.addEventListener('scroll', onScroll, true)
window.addEventListener('resize', onScroll)
onBeforeUnmount(() => {
  clearTimeout(showT); clearTimeout(hideT)
  bind(props.root, false)
  document.removeEventListener('keydown', onKey)
  document.removeEventListener('pointerdown', onDocPointer, true)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
})

function keepOpen() { clearTimeout(hideT) }
function onCardFocusOut(e: FocusEvent) {
  if (!cardEl.value?.contains(e.relatedTarget as Node | null)) hide()
}

function initials(name: string) {
  return (name || '?').slice(0, 2).toUpperCase()
}
</script>

<template>
  <Teleport to="body">
    <div
      ref="cardEl"
      class="mention-card"
      :class="{ show: visible }"
      :style="pos"
      role="dialog"
      :aria-hidden="!visible"
      :aria-label="`${card.name} 프로필`"
      @mouseenter="keepOpen"
      @mouseleave="hide()"
      @focusin="keepOpen"
      @focusout="onCardFocusOut"
    >
      <div class="mc-who">
        <img v-if="card.avatar" :src="card.avatar" :alt="card.name" class="mc-av" />
        <span v-else class="mc-av mc-initials">{{ initials(card.name) }}</span>
        <div class="mc-id">
          <span class="mc-name">{{ card.name }}</span>
          <span class="mc-sub">@{{ card.handle }}<template v-if="commentCounts.get(card.uid)"> · 이 케이스 댓글 {{ commentCounts.get(card.uid) }}개</template></span>
        </div>
      </div>
      <div class="mc-acts">
        <button
          v-if="canFollow"
          type="button"
          class="mc-btn"
          :class="following ? 'mc-secondary' : 'mc-primary'"
          :disabled="following == null || followBusy"
          :tabindex="visible ? 0 : -1"
          @click="toggleFollow"
        >{{ following ? '팔로잉' : '팔로우' }}</button>
        <button type="button" class="mc-btn mc-secondary" :tabindex="visible ? 0 : -1" @click="openProfile">프로필 보기</button>
      </div>
    </div>
  </Teleport>
</template>

<!-- 전역 스타일 — scoped 의 :global(.dark) 는 이 프로젝트 빌드에서 빠진다. -->
<style>
.mention-card {
  --mc-surface: #ffffff;
  --mc-line: #e4e4e7;
  --mc-ink: #18181b;
  --mc-muted: #71717a;
  --mc-btn: #047857;
  --mc-on-btn: #ffffff;
  --mc-av: rgba(16, 185, 129, .14);
  --mc-av-ink: #047857;
  position: fixed; z-index: 70; top: 0; left: 0;
  width: 16rem; max-width: calc(100vw - 32px);
  display: flex; flex-direction: column; gap: 12px; padding: 14px;
  background: var(--mc-surface); border: 1px solid var(--mc-line); border-radius: 12px;
  box-shadow: 0 16px 36px -10px rgba(24, 24, 27, .22), 0 2px 8px -3px rgba(24, 24, 27, .1);
  opacity: 0; transform: translateY(4px); pointer-events: none; visibility: hidden;
  transition: opacity .14s ease, transform .16s ease, visibility 0s linear .16s;
}
.dark .mention-card {
  --mc-surface: #26262b;
  --mc-line: #38383e;
  --mc-ink: #f4f4f5;
  --mc-muted: #8b8b94;
  --mc-btn: #34d399;
  --mc-on-btn: #052e22;
  --mc-av: rgba(52, 211, 153, .16);
  --mc-av-ink: #6ee7b7;
  box-shadow: 0 18px 40px -10px rgba(0, 0, 0, .6), 0 2px 8px -3px rgba(0, 0, 0, .5);
}
.mention-card.show {
  opacity: 1; transform: none; pointer-events: auto; visibility: visible;
  transition: opacity .14s ease, transform .16s ease;
}
.mc-who { display: flex; align-items: center; gap: 10px; min-width: 0; }
.mc-av { flex-shrink: 0; width: 36px; height: 36px; border-radius: 9999px; object-fit: cover; }
.mc-initials {
  display: grid; place-items: center; font-size: 12px; font-weight: 700;
  background: var(--mc-av); color: var(--mc-av-ink);
}
.mc-id { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mc-name { font-size: 13.5px; font-weight: 600; color: var(--mc-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mc-sub { font-size: 11.5px; color: var(--mc-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mc-acts { display: flex; gap: 8px; }
.mc-btn {
  flex: 1; padding: 7px 0; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;
  transition: opacity .12s, background-color .12s;
}
.mc-btn:disabled { opacity: .55; cursor: default; }
.mc-btn:focus-visible { outline: 2px solid #10b981; outline-offset: 2px; }
.mc-primary { background: var(--mc-btn); color: var(--mc-on-btn); border: 1px solid transparent; }
.mc-primary:not(:disabled):hover { opacity: .9; }
.mc-secondary { background: transparent; color: var(--mc-ink); border: 1px solid var(--mc-line); font-weight: 500; }
.mc-secondary:not(:disabled):hover { background: rgba(127, 127, 127, .08); }
@media (prefers-reduced-motion: reduce) {
  .mention-card, .mention-card.show { transition: none; }
}
</style>
