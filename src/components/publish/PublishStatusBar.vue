<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { publishmentApi } from '@/services/publishmentApi'
import type { PublishmentDetail } from '@/types/publish'
import { formatAbsolute } from '@/utils/timeAgo'
import { ChevronUpIcon } from '@heroicons/vue/24/outline'

// 소유자 여부는 부모(ErrorDetailPage)가 v-if 로 걸러준다 — 여긴 발행 상태만 다룬다.
const props = defineProps<{ caseId: number }>()

const pub = ref<PublishmentDetail | null>(null)
const expanded = ref(false)
const busy = ref(false)
const copied = ref(false)

const isLive = computed(() => pub.value?.status === 'LIVE')
const visLabel = computed(() => (pub.value?.visibility === 'UNLISTED' ? 'Unlisted' : 'Public'))

onMounted(async () => {
  try {
    const { data } = await publishmentApi.getByCase(props.caseId)
    pub.value = data
  } catch (e) {
    // 404 = 이 케이스는 발행된 적 없음 → 바를 띄우지 않는다. 그 외 에러도 조용히 숨김.
    if (!axios.isAxiosError(e) || e.response?.status !== 404) pub.value = null
  }
})

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
  } catch {
    plainToast('Couldn’t restore. Try again.')
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
        <div class="psb-metric"><div class="n">{{ formatAbsolute(pub.publishedAt) }}</div><div class="l">Published</div></div>
      </div>
    </Transition>

    <div class="psb-bar">
      <span class="psb-dot" :class="isLive ? 'live' : 'off'" />
      <a v-if="isLive" :href="pub.publicUrl" target="_blank" rel="noopener" class="psb-url">/p/{{ pub.slug }}</a>
      <span v-else class="psb-url off">/p/{{ pub.slug }}</span>
      <span class="psb-sep">·</span>
      <span class="psb-stat">{{ isLive ? `${pub.viewCount} views` : 'Offline · link returns 410' }}</span>

      <span class="psb-spacer" />

      <span v-if="isLive" class="psb-badge" :class="pub.visibility === 'UNLISTED' ? 'unlisted' : 'public'">{{ visLabel }}</span>

      <template v-if="isLive">
        <button class="psb-txt" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</button>
        <button class="psb-txt" @click="openPdf">PDF</button>
        <button class="psb-txt danger" :disabled="busy" @click="down">Down</button>
      </template>
      <button v-else class="psb-txt primary" :disabled="busy" @click="up">Restore</button>

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
</template>

<style scoped>
/* 사이드바(w-20=80px) 만큼 오른쪽으로 밀어 본문 위 중앙에 둔다. */
.psb-wrap {
  position: fixed;
  left: calc(50% + 40px);
  bottom: 22px;
  transform: translateX(-50%);
  z-index: 40;
  width: min(720px, calc(100vw - 120px));
}
.psb-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 50px;
  padding: 0 16px;
  background: rgba(255, 255, 255, .9);
  backdrop-filter: blur(12px);
  border: 1px solid #e4e4e7;
  border-radius: 16px;
  box-shadow: 0 16px 44px rgba(0, 0, 0, .14);
}
:global(.dark) .psb-bar {
  background: rgba(38, 38, 42, .85);
  border-color: #34343a;
  box-shadow: 0 16px 46px rgba(0, 0, 0, .6);
}

.psb-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
.psb-dot.live { background: #10b981; transform-origin: center; animation: psb-breathe 1.5s ease-in-out infinite; }
.psb-dot.off { background: #a1a1aa; box-shadow: 0 0 0 3px #f4f4f5; }
:global(.dark) .psb-dot.off { box-shadow: 0 0 0 3px #27272a; }
@keyframes psb-breathe {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.24); opacity: .72; }
}

.psb-url { font-family: "JetBrains Mono", ui-monospace, Menlo, monospace; font-size: 12.5px; color: #18181b; white-space: nowrap; text-decoration: none; }
.psb-url:hover { color: #059669; }
.psb-url.off { color: #71717a; }
:global(.dark) .psb-url { color: #e4e4e7; }
:global(.dark) .psb-url.off { color: #a1a1aa; }
.psb-sep { color: #a1a1aa; }
.psb-stat { font-size: 12px; color: #71717a; white-space: nowrap; }
.psb-spacer { flex: 1; }

.psb-badge { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 2px 7px; border-radius: 5px; }
.psb-badge.public { background: #ecfdf5; color: #059669; }
.psb-badge.unlisted { background: #fffbeb; color: #92400e; }
:global(.dark) .psb-badge.public { background: rgba(16, 185, 129, .12); color: #34d399; }
:global(.dark) .psb-badge.unlisted { background: rgba(245, 158, 11, .12); color: #fbbf24; }

.psb-txt { background: none; border: 0; font: 500 12.5px "Inter", sans-serif; color: #71717a; cursor: pointer; padding: 4px 6px; border-radius: 7px; transition: color .15s; white-space: nowrap; }
.psb-txt:hover { color: #059669; }
.psb-txt.danger:hover { color: #e11d48; }
.psb-txt.primary { color: #059669; font-weight: 600; }
.psb-txt.primary:hover { color: #047857; }
.psb-txt:disabled { opacity: .5; cursor: default; }
:global(.dark) .psb-txt { color: #a1a1aa; }

.psb-chev { width: 28px; height: 28px; border-radius: 8px; border: 0; background: none; color: #a1a1aa; cursor: pointer; display: grid; place-items: center; transition: color .15s, transform .3s; }
.psb-chev:hover { color: #52525b; }
.psb-chev.open { transform: rotate(180deg); }
:global(.dark) .psb-chev:hover { color: #d4d4d8; }

/* 펼침 카드 (지표) */
.psb-card {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 12px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, .95);
  backdrop-filter: blur(12px);
  border: 1px solid #e4e4e7;
  border-radius: 14px;
  box-shadow: 0 16px 44px rgba(0, 0, 0, .12);
}
:global(.dark) .psb-card { background: rgba(38, 38, 42, .9); border-color: #34343a; }
.psb-metric { background: #fafafa; border: 1px solid #f4f4f5; border-radius: 10px; padding: 10px 8px; text-align: center; }
:global(.dark) .psb-metric { background: #232327; border-color: #27272a; }
.psb-metric .n { font-size: 18px; font-weight: 600; color: #18181b; font-variant-numeric: tabular-nums; line-height: 1.1; }
:global(.dark) .psb-metric .n { color: #e4e4e7; }
.psb-metric .l { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #a1a1aa; margin-top: 3px; }

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
  background: #18181b;
  color: #e4e4e7;
  border-radius: 12px;
  padding: 11px 14px 11px 16px;
  box-shadow: 0 14px 38px rgba(0, 0, 0, .4);
  white-space: nowrap;
}
:global(.dark) .psb-toast { background: #000; border: 1px solid #2a2a2f; }
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

@media (prefers-reduced-motion: reduce) {
  .psb-dot.live { animation: none; }
}
</style>
