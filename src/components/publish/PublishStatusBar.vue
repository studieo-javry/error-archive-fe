<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { publishmentApi } from '@/services/publishmentApi'
import type { PublishmentDetail } from '@/types/publish'
import { formatAbsolute } from '@/utils/timeAgo'
import { ChevronUpIcon } from '@heroicons/vue/24/outline'

// 발행 여부 판정(getByCase/404)과 소유자 게이팅은 부모(ErrorDetailPage)가 한다 —
// 여긴 이미 발행된 케이스의 상태만 표현/조작한다. detail 은 최초 스냅샷.
const props = defineProps<{ detail: PublishmentDetail }>()
// 상태 바에서 down/up 으로 status 가 바뀌면 부모(액션행 라벨)도 동기화하도록 알린다.
// deleted: 영구 삭제 완료 — 부모는 발행물 상태를 비워(→ 다시 Publish 트리거) 상태 바를 내린다.
const emit = defineEmits<{ update: [detail: PublishmentDetail]; deleted: [] }>()

// 내부 상태로 복제 — unpublish/restore 로 status 가 바뀌면 여기서 갱신한다.
// 부모가 detail 을 다시 넘기면(다른 케이스로 이동 등) 동기화.
const pub = ref<PublishmentDetail>({ ...props.detail })
watch(() => props.detail, d => { pub.value = { ...d } })

const expanded = ref(false)
const busy = ref(false)
const copied = ref(false)

const isLive = computed(() => pub.value?.status === 'LIVE')
const visLabel = computed(() => (pub.value?.visibility === 'UNLISTED' ? 'Unlisted' : 'Public'))
// 참조 시안과 동일하게: 프로토콜 없는 전체 도메인 URL, 콤마 구분 조회수.
const displayUrl = computed(() => pub.value.publicUrl.replace(/^https?:\/\//, ''))
const viewsLabel = computed(() => pub.value.viewCount.toLocaleString())

// 발행일: 상대 시간(2h ago) 표기. hover 시 정확한 일시를 title 로 병기.
function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  const m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (s < 60) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return formatAbsolute(iso) // 30일 넘으면 절대 날짜로
}
const publishedRel = computed(() => relTime(pub.value.publishedAt))

async function copy() {
  if (!pub.value) return
  try {
    await navigator.clipboard.writeText(pub.value.publicUrl)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch { /* clipboard 미지원 무시 */ }
}
function openPdf() {
  if (pub.value) window.open(pub.value.pdfUrl, '_blank', 'noopener')
}

// ── 발행 내리기(Down): 즉시 반영 + 5초 실행취소 토스트 ──
const toast = ref<{ show: boolean; msg: string; undo: (() => void) | null }>({ show: false, msg: '', undo: null })
let toastTimer: ReturnType<typeof setTimeout> | undefined

function plainToast(msg: string, ms = 2400) {
  toast.value = { show: true, msg, undo: null }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value.show = false }, ms)
}
function undoToast(msg: string, undo: () => void, ms = 5000) {
  toast.value = { show: true, msg, undo }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value.show = false }, ms)
}
function hideToast() { toast.value.show = false; clearTimeout(toastTimer) }
onUnmounted(() => clearTimeout(toastTimer))

async function down() {
  if (!pub.value || busy.value) return
  const slug = pub.value.slug
  busy.value = true
  try {
    const { data } = await publishmentApi.unpublish(slug)
    pub.value = data // UNPUBLISHED
    emit('update', data)
    undoToast('Unpublished — the public link now returns 410.', async () => {
      hideToast()
      await restoreBySlug(slug)
    })
  } catch {
    plainToast('Couldn’t unpublish. Try again.')
  } finally {
    busy.value = false
  }
}

async function up() {
  if (!pub.value || busy.value) return
  await restoreBySlug(pub.value.slug)
}
async function restoreBySlug(slug: string) {
  busy.value = true
  try {
    const { data } = await publishmentApi.restore(slug)
    pub.value = data // LIVE
    emit('update', data)
  } catch {
    plainToast('Couldn’t restore. Try again.')
  } finally {
    busy.value = false
  }
}

// ── 삭제 다이얼로그 (E → D) ──
// E: "내리기 vs 영구 삭제" 갈림. LIVE 일 때만 내리기 권유 단계를 거치고,
//    이미 내려진(offline) 상태면 내리기 선택지가 무의미하니 바로 D(확정)로 간다.
const dialog = ref<'E' | 'D' | null>(null)
const ack = ref(false)

function openDeleteDialog() {
  if (busy.value) return
  ack.value = false
  dialog.value = isLive.value ? 'E' : 'D'
}
function closeDialog() { dialog.value = null }
// E 에서 "내리기(추천)" 선택 → 기존 unpublish 플로우(실행취소 토스트 포함).
async function chooseUnpublish() {
  closeDialog()
  await down()
}
// E 에서 "영구 삭제" 선택 → D(상세 확인)로.
function goHardDelete() { ack.value = false; dialog.value = 'D' }

async function doDelete() {
  if (!pub.value || busy.value) return
  const slug = pub.value.slug
  busy.value = true
  try {
    await publishmentApi.delete(slug)
    closeDialog()
    emit('deleted')
    plainToast('Deleted — the public link now returns 404.')
  } catch {
    plainToast('Couldn’t delete. Try again.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="pub" class="psb-wrap">
    <Transition name="psb-card">
      <div v-if="expanded" class="psb-card">
        <div class="psb-metric"><div class="n">{{ pub.viewCount }}</div><div class="l">Views</div></div>
        <div class="psb-metric"><div class="n">{{ pub.downloadCount }}</div><div class="l">Downloads</div></div>
        <div class="psb-metric"><div class="n">v{{ pub.version }}</div><div class="l">Version</div></div>
        <div class="psb-metric pub-metric" :data-tip="formatAbsolute(pub.publishedAt)"><div class="n">{{ publishedRel }}</div><div class="l">Published</div></div>
      </div>
    </Transition>

    <div class="psb-bar">
      <span class="psb-dot" :class="isLive ? 'live' : 'off'" />
      <a v-if="isLive" :href="pub.publicUrl" target="_blank" rel="noopener" class="psb-url">{{ displayUrl }}</a>
      <span v-else class="psb-url off">{{ displayUrl }}</span>
      <span class="psb-sep">·</span>
      <span class="psb-stat">{{ isLive ? `${viewsLabel} views` : 'link returns 410' }}</span>

      <span class="psb-spacer" />

      <span v-if="isLive" class="psb-badge" :class="pub.visibility === 'UNLISTED' ? 'unlisted' : 'public'">{{ visLabel }}</span>

      <template v-if="isLive">
        <button class="psb-txt" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</button>
        <button class="psb-txt" @click="openPdf">PDF</button>
        <span class="psb-div" />
        <!-- 자물쇠: 평소 열림 → hover 시 닫힘(발행 내리기) -->
        <button class="psb-unpub" :disabled="busy" @click="down">
          <svg class="lockicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path class="shackle" d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
            <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.2" />
          </svg>
          Down
        </button>
      </template>
      <button v-else class="psb-txt primary" :disabled="busy" @click="up">Restore</button>

      <!-- 영구 삭제 진입 — 항상 노출(내려진 상태에서도 삭제 가능) -->
      <button class="psb-del" :disabled="busy" @click="openDeleteDialog">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-11.001.166v-.916c0-1.18.91-2.164 2.09-2.201a51.964 51.964 0 013.32 0c1.18.037 2.09 1.022 2.09 2.201v.916" />
        </svg>
        Delete
      </button>

      <button class="psb-chev" :class="{ open: expanded }" aria-label="Toggle details" @click="expanded = !expanded">
        <ChevronUpIcon class="w-4 h-4" />
      </button>
    </div>
  </div>

  <Transition name="psb-toast">
    <div v-if="toast.show" class="psb-toast">
      <svg v-if="toast.undo" class="ring" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" /><circle class="p" cx="10" cy="10" r="7" /></svg>
      <span class="tmsg">{{ toast.msg }}</span>
      <button v-if="toast.undo" class="tundo" @click="toast.undo()">Undo</button>
    </div>
  </Transition>

  <!-- 삭제 다이얼로그 (E: 내리기 vs 삭제 갈림 → D: 상세 확인) -->
  <Transition name="psb-back">
    <div v-if="dialog" class="psb-backdrop" @click.self="closeDialog">
      <div class="psb-modal">
        <!-- E: 어떻게 할까요? -->
        <template v-if="dialog === 'E'">
          <div class="m-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-11.001.166v-.916c0-1.18.91-2.164 2.09-2.201a51.964 51.964 0 013.32 0c1.18.037 2.09 1.022 2.09 2.201v.916" /></svg>
          </div>
          <div class="m-title">이 발행물을 어떻게 할까요?</div>
          <div class="m-body">대부분의 경우 <b>내리기</b>로 충분해요 — 링크만 막고 언제든 되살릴 수 있어요.</div>
          <div class="choice">
            <button class="choice-opt safe rec" :disabled="busy" @click="chooseUnpublish">
              <div class="ci">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.2" /></svg>
              </div>
              <div class="tx">
                <div class="ct">내리기 (unpublish)<span class="rec-badge">추천</span></div>
                <div class="cd">공개 링크 410. slug·조회수·스냅샷 보존 → 다시 공개 가능.</div>
              </div>
            </button>
            <button class="choice-opt hard" :disabled="busy" @click="goHardDelete">
              <div class="ci">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-11.001.166v-.916c0-1.18.91-2.164 2.09-2.201a51.964 51.964 0 013.32 0c1.18.037 2.09 1.022 2.09 2.201v.916" /></svg>
              </div>
              <div class="tx">
                <div class="ct">영구 삭제</div>
                <div class="cd">전부 삭제, slug 반납, 복구 불가.</div>
              </div>
            </button>
          </div>
          <div class="m-actions"><button class="m-btn ghost" @click="closeDialog">취소</button></div>
        </template>

        <!-- D: 영구 삭제 상세 확인 -->
        <template v-else>
          <div class="m-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-11.001.166v-.916c0-1.18.91-2.164 2.09-2.201a51.964 51.964 0 013.32 0c1.18.037 2.09 1.022 2.09 2.201v.916" /></svg>
          </div>
          <div class="m-title">발행물 영구 삭제</div>
          <div class="m-body">이 발행물을 완전히 지웁니다. <b>되돌릴 수 없어요.</b></div>
          <div class="consequences">
            <div class="cq-row">
              <span class="cq-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg></span>
              <div class="cq-tx"><div class="cq-t">공개 페이지가 <b>404</b>가 돼요</div><div class="cq-d">{{ displayUrl }} 접속 불가</div></div>
            </div>
            <div class="cq-row">
              <span class="cq-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg></span>
              <div class="cq-tx"><div class="cq-t">이 주소로 <b>다시 발행할 수 없어요</b></div><div class="cq-d">slug 영구 반납</div></div>
            </div>
            <div class="cq-row">
              <span class="cq-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg></span>
              <div class="cq-tx"><div class="cq-t">쌓인 데이터가 <b>모두 사라져요</b></div><div class="cq-d">스냅샷 · 조회수 · PDF</div></div>
            </div>
          </div>
          <label class="ack"><input type="checkbox" v-model="ack"><span>위 내용을 이해했고, 이 발행물을 <b>영구 삭제</b>합니다.</span></label>
          <div class="m-actions">
            <button class="m-btn ghost" @click="closeDialog">취소</button>
            <button class="m-btn danger" :disabled="!ack || busy" @click="doDelete">영구 삭제</button>
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>

<!-- 테마 토큰은 비-scoped(전역) — 이 프로젝트는 scoped <style> 의 :global(.dark) 가
     빌드에서 통째로 누락돼 다크가 안 먹었다. 전역 :root/.dark 는 app.css 처럼 정상 동작. -->
<style>
:root {
  --psb-surface: #ffffff;
  --psb-line: #e4e4e7;
  --psb-line-soft: #f4f4f5;
  --psb-metric-bg: #fafafa;
  --psb-ink: #18181b;
  --psb-sub: #71717a;
  --psb-faint: #a1a1aa;
  --psb-accent: #059669;
  --psb-accent-soft: #ecfdf5;
  --psb-amber: #92400e;
  --psb-amber-soft: #fffbeb;
  --psb-rose: #e11d48;
  --psb-rose-2: #be123c;
  --psb-rose-soft: #fff1f2;
  --psb-on-fill: #ffffff;
  --psb-backdrop: rgba(24, 24, 27, .32);
  --psb-chev-hover: #52525b;
  --psb-toast-bg: #18181b;
  --psb-toast-border: transparent;
  --psb-shadow-bar: 0 18px 55px rgba(0, 0, 0, .16), inset 0 1px 0 rgba(255, 255, 255, .5);
  --psb-shadow-card: 0 18px 55px rgba(0, 0, 0, .12), inset 0 1px 0 rgba(255, 255, 255, .5);
  --psb-gloss: linear-gradient(rgba(255, 255, 255, .4), transparent);
}
.dark {
  --psb-surface: #000;
  --psb-line: rgba(255, 255, 255, .1);
  --psb-line-soft: rgba(255, 255, 255, .08);
  --psb-metric-bg: #18181b;
  --psb-ink: #e4e4e7;
  --psb-sub: #a1a1aa;
  --psb-faint: #71717a;
  --psb-accent: #34d399;
  --psb-accent-soft: rgba(16, 185, 129, .12);
  --psb-amber: #fbbf24;
  --psb-amber-soft: rgba(245, 158, 11, .12);
  --psb-rose: #fb7185;
  --psb-rose-2: #fda4af;
  --psb-rose-soft: rgba(225, 29, 72, .16);
  --psb-on-fill: #0b0b0d;
  --psb-backdrop: rgba(0, 0, 0, .55);
  --psb-chev-hover: #d4d4d8;
  --psb-toast-bg: #000;
  --psb-toast-border: #2a2a2f;
  --psb-shadow-bar: 0 16px 40px -8px rgba(0, 0, 0, .4);
  --psb-shadow-card: 0 20px 48px -10px rgba(0, 0, 0, .5);
  --psb-gloss: transparent;
}
</style>

<style scoped>
/* 사이드바(w-20=80px) 만큼 오른쪽으로 밀어 본문 위 중앙에 둔다. */
.psb-wrap {
  position: fixed;
  left: calc(50% + 40px);
  bottom: 22px;
  transform: translateX(-50%);
  z-index: 40;
  width: min(720px, calc(100vw - 120px));
  /* 참조 HTML 과 동일한 폰트 렌더 — 없으면 macOS 에서 글자가 더 굵고 진하게 보인다 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
/* 참조 .statusbar 그대로: 솔리드 배경 + 26px 라운드 + 안쪽 하이라이트 그림자 + 상단 광택 */
.psb-bar {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 52px;
  padding: 0 16px;
  background: var(--psb-surface);
  border: 1px solid var(--psb-line);
  border-radius: 26px;
  box-shadow: var(--psb-shadow-bar);
}
/* 상단 유리 광택 */
.psb-bar::before {
  content: "";
  position: absolute;
  left: 0; right: 0; top: 0;
  height: 42%;
  border-radius: 26px 26px 0 0;
  pointer-events: none;
  background: var(--psb-gloss);
}
.psb-bar > * { position: relative; z-index: 1; }
/* 우측 액션들은 절대 줄어들지 않게 — 좁아지면 URL(위 flex-shrink:1)만 …로 축약 */
.psb-badge, .psb-txt, .psb-div, .psb-unpub, .psb-del, .psb-chev, .psb-dot, .psb-sep, .psb-stat { flex-shrink: 0; }

.psb-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
.psb-dot.live { background: #10b981; transform-origin: center; animation: psb-breathe 1.5s ease-in-out infinite; }
.psb-dot.off { background: var(--psb-faint); box-shadow: 0 0 0 3px var(--psb-line-soft); }
@keyframes psb-breathe {
  0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(16, 185, 129, .7); }
  50% { transform: scale(1.24); opacity: .76; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0); }
}

.psb-url { font-family: "JetBrains Mono", ui-monospace, Menlo, monospace; font-size: 13px; color: var(--psb-ink); white-space: nowrap; text-decoration: none; transition: color .15s; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex-shrink: 1; }
.psb-url:hover { color: var(--psb-accent); }
.psb-url.off { color: var(--psb-sub); }
.psb-sep { color: var(--psb-faint); }
.psb-stat { font-size: 12.5px; color: var(--psb-sub); white-space: nowrap; }
.psb-spacer { flex: 1; }

/* 참조의 mini-badge: 라운드 pill */
.psb-badge { font-size: 10.5px; font-weight: 600; padding: 3px 8px; border-radius: 999px; flex-shrink: 0; }
.psb-badge.public { background: var(--psb-accent-soft); color: var(--psb-accent); }
.psb-badge.unlisted { background: var(--psb-amber-soft); color: var(--psb-amber); }

.psb-txt { background: none; border: 0; font: 400 12px "Inter", sans-serif; color: var(--psb-sub); cursor: pointer; padding: 4px 4px; border-radius: 7px; transition: color .15s; white-space: nowrap; flex-shrink: 0; }
.psb-txt:hover { color: var(--psb-accent); }
.psb-txt.primary { color: var(--psb-accent); font-weight: 500; }
.psb-txt.primary:hover { opacity: .82; }
.psb-txt:disabled { opacity: .5; cursor: default; }

/* 구분선 + 발행 내리기(자물쇠) — 참조 publish-case-status-v1.html 그대로 */
.psb-div { width: 1px; height: 16px; background: var(--psb-line); flex-shrink: 0; }
.psb-unpub { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 9px; font: 400 12px "Inter", sans-serif; border: 0; background: none; color: var(--psb-sub); cursor: pointer; transition: .15s; white-space: nowrap; }
.psb-unpub:hover { background: var(--psb-rose-soft); color: var(--psb-rose); }
.psb-unpub:disabled { opacity: .5; cursor: default; }
.psb-unpub svg { width: 14px; height: 14px; }
.lockicon .shackle { transform-box: view-box; transform-origin: 8px 10.5px; transform: rotate(-38deg); transition: transform .34s cubic-bezier(.34, 1.56, .64, 1); }
.psb-unpub:hover .lockicon .shackle { transform: rotate(0deg); }

/* 영구 삭제(빨강 텍스트) 바 버튼 */
.psb-del { display: inline-flex; align-items: center; gap: 5px; font: 400 12px "Inter", sans-serif; color: var(--psb-rose); background: none; border: 0; cursor: pointer; padding: 4px 7px; border-radius: 8px; white-space: nowrap; flex-shrink: 0; transition: background .15s; }
.psb-del:hover { background: var(--psb-rose-soft); }
.psb-del:disabled { opacity: .5; cursor: default; }
.psb-del svg { width: 13px; height: 13px; }

/* ── 삭제 다이얼로그 ── */
.psb-backdrop { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 20px; background: var(--psb-backdrop); }
.psb-modal { width: 100%; max-width: 400px; background: var(--psb-surface); border: 1px solid var(--psb-line); border-radius: 16px; box-shadow: 0 24px 70px rgba(0, 0, 0, .28); padding: 22px; }
.psb-modal .m-ic { width: 44px; height: 44px; border-radius: 12px; background: var(--psb-rose-soft); color: var(--psb-rose); display: grid; place-items: center; margin-bottom: 14px; }
.psb-modal .m-ic svg { width: 22px; height: 22px; }
.psb-modal .m-title { font-size: 16px; font-weight: 600; color: var(--psb-ink); margin-bottom: 7px; }
.psb-modal .m-body { font-size: 12.5px; color: var(--psb-sub); line-height: 1.6; }
.psb-modal .m-body b { color: var(--psb-ink); font-weight: 600; }

/* 선택지(내리기 / 영구 삭제) — G(밑줄 draw) + F(아이콘 팝) */
.choice { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.choice-opt { position: relative; overflow: hidden; display: flex; gap: 11px; align-items: flex-start; border: 1px solid var(--psb-line); border-radius: 12px; padding: 12px 14px; cursor: pointer; text-align: left; background: var(--psb-surface); width: 100%; transition: background .2s, border-color .2s; }
.choice-opt:disabled { opacity: .55; cursor: default; }
.choice-opt.rec { border-color: color-mix(in srgb, var(--psb-accent) 45%, transparent); }
.choice-opt::after { content: ""; position: absolute; left: 0; bottom: 0; height: 2.5px; width: 100%; transform: scaleX(0); transform-origin: left; transition: transform .28s cubic-bezier(.4, 0, .2, 1); }
.choice-opt.safe::after { background: var(--psb-accent); }
.choice-opt.hard::after { background: var(--psb-rose); }
.choice-opt:not(:disabled):hover::after { transform: scaleX(1); }
.choice-opt.safe:not(:disabled):hover { background: var(--psb-accent-soft); }
.choice-opt.hard:not(:disabled):hover { background: var(--psb-rose-soft); }
.choice-opt .ci { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; transition: background .2s, color .2s, transform .25s; }
.choice-opt .ci svg { width: 15px; height: 15px; }
.choice-opt.safe .ci { background: var(--psb-accent-soft); color: var(--psb-accent); }
.choice-opt.hard .ci { background: var(--psb-rose-soft); color: var(--psb-rose); }
.choice-opt.safe:not(:disabled):hover .ci { background: var(--psb-accent); color: var(--psb-on-fill); transform: scale(1.08); }
.choice-opt.hard:not(:disabled):hover .ci { background: var(--psb-rose); color: var(--psb-on-fill); transform: scale(1.08); }
.choice-opt .tx { min-width: 0; }
.choice-opt .ct { font-size: 13px; font-weight: 600; color: var(--psb-ink); display: flex; align-items: center; }
.choice-opt .cd { font-size: 11px; color: var(--psb-sub); line-height: 1.45; margin-top: 2px; }
.rec-badge { font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--psb-accent); background: var(--psb-accent-soft); padding: 1px 6px; border-radius: 5px; margin-left: 6px; }

/* 결과 리스트 (D) */
.consequences { margin: 15px 0 0; display: flex; flex-direction: column; }
.cq-row { display: flex; gap: 11px; align-items: flex-start; padding: 9px 2px; }
.cq-row + .cq-row { border-top: 1px solid var(--psb-line); }
.cq-ic { flex-shrink: 0; width: 20px; height: 20px; border-radius: 6px; background: var(--psb-rose-soft); color: var(--psb-rose); display: grid; place-items: center; margin-top: 1px; }
.cq-ic svg { width: 12px; height: 12px; }
.cq-tx { min-width: 0; }
.cq-t { font-size: 12.5px; color: var(--psb-ink); line-height: 1.4; }
.cq-t b { font-weight: 600; }
.cq-d { font-size: 11px; color: var(--psb-faint); margin-top: 2px; word-break: break-all; }

.ack { display: flex; gap: 8px; align-items: flex-start; margin-top: 14px; font-size: 12px; color: var(--psb-sub); line-height: 1.5; cursor: pointer; }
.ack input { margin-top: 2px; accent-color: var(--psb-rose); width: 15px; height: 15px; flex-shrink: 0; }
.ack b { color: var(--psb-ink); font-weight: 600; }

.m-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.m-btn { font: 500 13px "Inter", sans-serif; padding: 8px 15px; border-radius: 10px; cursor: pointer; border: 1px solid var(--psb-line); background: none; color: var(--psb-sub); transition: background .15s, color .15s; }
.m-btn.ghost:hover { color: var(--psb-ink); background: var(--psb-line-soft); }
.m-btn.danger { background: var(--psb-rose); color: var(--psb-on-fill); border: 0; }
.m-btn.danger:hover { background: var(--psb-rose-2); }
.m-btn:disabled { opacity: .5; cursor: default; }

.psb-back-enter-active, .psb-back-leave-active { transition: opacity .2s; }
.psb-back-enter-active .psb-modal, .psb-back-leave-active .psb-modal { transition: transform .22s cubic-bezier(.34, 1.3, .5, 1), opacity .22s; }
.psb-back-enter-from, .psb-back-leave-to { opacity: 0; }
.psb-back-enter-from .psb-modal, .psb-back-leave-to .psb-modal { transform: translateY(10px) scale(.98); opacity: 0; }

.psb-chev { width: 28px; height: 28px; border-radius: 8px; border: 0; background: none; color: var(--psb-faint); cursor: pointer; display: grid; place-items: center; transition: color .15s, transform .3s; }
.psb-chev:hover { color: var(--psb-chev-hover); }
.psb-chev.open { transform: rotate(180deg); }

/* 펼침 카드 (지표) */
.psb-card {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 14px;
  margin-bottom: 8px;
  background: var(--psb-surface);
  border: 1px solid var(--psb-line);
  border-radius: 22px;
  box-shadow: var(--psb-shadow-card);
}
/* 셀 높이가 달라도(예: 날짜 줄바꿈) 글자가 위로 쏠리지 않게 세로 중앙 정렬 */
.psb-metric { background: var(--psb-metric-bg); border: 1px solid var(--psb-line-soft); border-radius: 10px; padding: 10px 8px; text-align: center; display: flex; flex-direction: column; justify-content: center; }
.psb-metric .n { font-size: 18px; font-weight: 600; color: var(--psb-ink); font-variant-numeric: tabular-nums; line-height: 1.1; }
.psb-metric .l { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: var(--psb-faint); margin-top: 3px; }

/* Published 셀 hover 툴팁 — 상대 시간(2h ago)에 마우스 올리면 정확한 일시 표시.
   토큰(--psb-toast-*)은 전역이라 다크에도 반응한다. */
.pub-metric { position: relative; cursor: help; }
.pub-metric::after {
  content: attr(data-tip);
  position: absolute; bottom: calc(100% + 8px); left: 50%;
  transform: translateX(-50%) translateY(4px);
  background: var(--psb-toast-bg); color: #e4e4e7; border: 1px solid var(--psb-toast-border);
  font-size: 11px; font-weight: 500; white-space: nowrap; padding: 6px 10px; border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .28);
  opacity: 0; pointer-events: none; transition: opacity .15s, transform .15s; z-index: 20;
}
.pub-metric::before {
  content: ""; position: absolute; bottom: calc(100% + 3px); left: 50%;
  transform: translateX(-50%) translateY(4px);
  border: 5px solid transparent; border-top-color: var(--psb-toast-bg);
  opacity: 0; transition: opacity .15s, transform .15s; z-index: 20;
}
.pub-metric:hover::after, .pub-metric:hover::before { opacity: 1; transform: translateX(-50%) translateY(0); }

/* 토스트 */
.psb-toast {
  position: fixed;
  left: calc(50% + 40px);
  bottom: 84px;
  transform: translateX(-50%);
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 13px;
  background: var(--psb-toast-bg);
  color: #e4e4e7;
  border: 1px solid var(--psb-toast-border);
  border-radius: 12px;
  padding: 11px 14px 11px 16px;
  box-shadow: 0 14px 38px rgba(0, 0, 0, .4);
  white-space: nowrap;
}
.psb-toast .tmsg { font-size: 12.5px; }
.psb-toast .tundo { display: inline-flex; align-items: center; background: none; border: 0; color: #5eead4; font: 600 12.5px "Inter", sans-serif; cursor: pointer; padding: 3px 4px; }
.psb-toast .tundo:hover { color: #99f6e4; }
.psb-toast .ring { width: 16px; height: 16px; }
.psb-toast .ring circle { fill: none; stroke: #3f3f46; stroke-width: 3; }
.psb-toast .ring .p { stroke: #5eead4; stroke-dasharray: 44; stroke-dashoffset: 0; transform: rotate(-90deg); transform-origin: center; animation: psb-count 5s linear forwards; }
@keyframes psb-count { to { stroke-dashoffset: 44; } }

/* transitions */
.psb-card-enter-active, .psb-card-leave-active { transition: opacity .25s, transform .3s cubic-bezier(.34, 1.4, .5, 1); }
.psb-card-enter-from, .psb-card-leave-to { opacity: 0; transform: translateY(10px) scale(.97); }
.psb-toast-enter-active, .psb-toast-leave-active { transition: opacity .25s, transform .25s cubic-bezier(.34, 1.3, .5, 1); }
.psb-toast-enter-from, .psb-toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(14px); }

/* 참조 파일과 동일하게 라이브 도트의 breathe 는 reduced-motion 에서도 유지한다
   (미세한 상태 신호라 접근성 부담이 낮음). transition 만 줄인다. */
@media (prefers-reduced-motion: reduce) {
  .psb-chev, .lockicon .shackle { transition: none; }
}
</style>
