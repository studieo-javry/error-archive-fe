<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { SimilarCaseItem } from '@/types/error'

const props = defineProps<{
  items: SimilarCaseItem[]
  query: string
  loading: boolean
  slug: string
}>()

const top = computed(() => props.items[0] ?? null)
const runners = computed(() => props.items.slice(1, 4))
const hasQuery = computed(() => props.query.trim().length >= 2)
const topWarn = computed(() => !!top.value?.likelyDuplicate)

function pct(item: SimilarCaseItem) {
  return Math.round(item.score * 100)
}

// 게이지/밴드 색 — 강한 중복은 서버 플래그(likelyDuplicate)로만, 그 외는 점수대.
function band(item: SimilarCaseItem) {
  if (item.likelyDuplicate) return { color: '#f59e0b', label: '중복 가능성 높음', warn: true }
  if (pct(item) >= 45) return { color: '#fbbf24', label: '유사한 사례', warn: false }
  return { color: '#fcd34d', label: '참고 사례', warn: false }
}

const C = 2 * Math.PI * 40
function dashOffset(item: SimilarCaseItem) {
  return (C * (1 - pct(item) / 100)).toFixed(1)
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', DRAFT: 'Draft', CLOSED: 'Closed',
}
function statusLabel(s: string) {
  return STATUS_LABEL[s] ?? s
}
function statusClass(s: string) {
  if (s === 'OPEN') return 'text-rose-500'
  if (s === 'IN_PROGRESS') return 'text-blue-500'
  if (s === 'RESOLVED') return 'text-emerald-600 dark:text-emerald-400'
  return 'text-zinc-400'
}
function dotStyle(s: string) {
  const c = s === 'OPEN' ? '#f43f5e' : s === 'IN_PROGRESS' ? '#3b82f6' : s === 'RESOLVED' ? '#10b981' : '#a1a1aa'
  return { background: c }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
// matchedTerms(소문자 토큰)에 걸리는 제목 단어를 <mark> 로 강조.
function highlight(title: string, terms: string[]) {
  if (!terms.length) return esc(title)
  return title.replace(/[A-Za-z0-9]+|[가-힣]+/g, (w) => {
    const lw = w.toLowerCase()
    const hit = terms.some((t) => lw === t || (t.length >= 3 && lw.startsWith(t)) || (lw.length >= 3 && t.startsWith(lw)))
    return hit ? `<mark>${esc(w)}</mark>` : esc(w)
  })
}
function eyebrow(item: SimilarCaseItem) {
  return item.tags.slice(0, 3).join(' / ')
}
function detailTo(id: number) {
  return { name: 'errorDetail', params: { slug: props.slug, id } }
}
</script>

<template>
  <section class="sim-panel">
    <div class="flex items-center gap-2 mb-1">
      <span class="sim-live" :class="{ on: loading }" />
      <span data-tour-chip class="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">비슷한 에러</span>
      <span
        v-if="hasQuery && items.length"
        class="ml-auto text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full"
      >{{ items.length }}건</span>
    </div>
    <p class="text-[11.5px] text-zinc-400 dark:text-zinc-500 mb-3 min-h-[15px]">
      <template v-if="!hasQuery">제목을 입력하면 기존 사례를 실시간으로 찾아줘요.</template>
      <template v-else-if="topWarn">⚠️ <b class="text-amber-500">중복 가능성이 높아요</b> — 먼저 확인!</template>
      <template v-else-if="items.length">이미 기록된 비슷한 사례예요.</template>
    </p>

    <!-- 비어있음 -->
    <div v-if="!hasQuery" class="sim-empty">
      <span class="sim-empty-big">⌕</span>
      예: <b>NullPointerException in OrderService</b>, <b>503 HikariCP</b> …<br>입력을 시작해 보세요.
    </div>
    <div v-else-if="!items.length" class="sim-empty">
      <span class="sim-empty-big">✎</span>
      겹치는 기존 케이스가 없습니다.<br>새로운 에러일 수 있어요 👍
    </div>

    <template v-else>
      <!-- 히어로 (최상위 1건) -->
      <RouterLink :to="detailTo(top!.id)" class="sim-hero" :class="{ warn: topWarn }">
        <div class="flex items-center gap-4">
          <div class="sim-gauge">
            <svg width="92" height="92" viewBox="0 0 92 92">
              <circle class="g-track" cx="46" cy="46" r="40" fill="none" stroke-width="8" />
              <circle
                class="g-fill" cx="46" cy="46" r="40" fill="none" stroke-width="8"
                :stroke="band(top!).color" :stroke-dasharray="C.toFixed(1)" :stroke-dashoffset="dashOffset(top!)"
              />
            </svg>
            <div class="g-center">
              <span class="g-pct">{{ pct(top!) }}<span class="text-[12px] font-semibold">%</span></span>
              <span class="g-cap">유사도</span>
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <span class="sim-band" :style="{ color: band(top!).color, background: `color-mix(in srgb, ${band(top!).color} 14%, transparent)` }">
              <template v-if="band(top!).warn">◆ </template>{{ band(top!).label }}
            </span>
            <div v-if="eyebrow(top!)" class="sim-eyebrow">{{ eyebrow(top!) }}</div>
            <!-- eslint-disable-next-line vue/no-v-html -- esc() 로 이스케이프 후 <mark> 만 삽입 -->
            <h3 class="sim-title" v-html="highlight(top!.title, top!.matchedTerms)" />
            <p v-if="top!.descriptionPreview" class="sim-prev">{{ top!.descriptionPreview }}</p>
          </div>
        </div>
        <div class="sim-foot">
          <span class="inline-flex items-center gap-1.5 text-[10.5px] font-medium" :class="statusClass(top!.status)">
            <span class="w-1.5 h-1.5 rounded-full" :style="dotStyle(top!.status)" />{{ statusLabel(top!.status) }}
          </span>
          <span class="text-[10.5px] text-zinc-400">#{{ top!.id }}</span>
          <span class="ml-auto text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">이 케이스 열기 →</span>
        </div>
      </RouterLink>

      <!-- 러너업 -->
      <div v-if="runners.length" class="mt-2.5">
        <div class="text-[10.5px] font-semibold text-zinc-400 dark:text-zinc-500 mx-0.5 mb-1.5 tracking-wide">그 외 비슷한 사례 {{ items.length - 1 }}건</div>
        <RouterLink v-for="r in runners" :key="r.id" :to="detailTo(r.id)" class="sim-mini">
          <div class="min-w-0 flex-1">
            <!-- eslint-disable-next-line vue/no-v-html -- esc() 로 이스케이프 후 <mark> 만 삽입 -->
            <div class="sim-mini-title" v-html="highlight(r.title, r.matchedTerms)" />
            <div class="text-[10px] text-zinc-400 mt-0.5">#{{ r.id }}</div>
          </div>
          <span class="flex items-center gap-1.5 flex-none">
            <span class="sim-bar"><span class="sim-fill" :style="{ width: pct(r) + '%' }" /></span>
            <span class="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 tabular-nums w-[30px] text-right">{{ pct(r) }}%</span>
          </span>
        </RouterLink>
      </div>
    </template>

    <p class="mt-3.5 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
      "중복 가능성 높음"은 유사도 85%↑ 이면서 예외 클래스가 같을 때만 떠요.
    </p>
  </section>
</template>

<style scoped>
.sim-panel { font-size: 13px; }
.sim-live { width: 7px; height: 7px; border-radius: 9999px; background: #10b981; flex: none; }
.sim-live.on { animation: sim-pulse 1.4s ease-out infinite; }
@keyframes sim-pulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.45); } 100% { box-shadow: 0 0 0 7px rgba(16,185,129,0); } }

.sim-empty {
  border: 1px dashed #e4e4e7; border-radius: 14px; padding: 26px 18px; text-align: center;
  color: #a1a1aa; font-size: 12.5px; line-height: 1.6;
}
:global(.dark) .sim-empty { border-color: #3f3f46; }
.sim-empty-big { font-size: 22px; display: block; margin-bottom: 8px; opacity: .8; }

.sim-hero {
  display: block; text-decoration: none; color: inherit;
  border: 1px solid #e4e4e7; border-radius: 16px; background: #fff; padding: 16px;
  box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.05);
  animation: sim-rise .28s cubic-bezier(.2,.7,.3,1) both; transition: border-color .18s;
}
:global(.dark) .sim-hero { background: #1b1b1f; border-color: #3f3f46; box-shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.4); }
.sim-hero:hover { border-color: color-mix(in srgb, #10b981 45%, #e4e4e7); }
.sim-hero.warn { border-color: color-mix(in srgb, #f59e0b 55%, #e4e4e7); background: color-mix(in srgb, #f59e0b 6%, #fff); }
:global(.dark) .sim-hero.warn { background: color-mix(in srgb, #f59e0b 8%, #1b1b1f); }
@keyframes sim-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

.sim-gauge { position: relative; width: 92px; height: 92px; flex: none; }
.sim-gauge svg { transform: rotate(-90deg); display: block; }
.sim-gauge .g-track { stroke: #ececed; }
:global(.dark) .sim-gauge .g-track { stroke: #2a2a2e; }
.sim-gauge .g-fill { stroke-linecap: round; transition: stroke-dashoffset .5s cubic-bezier(.2,.7,.3,1), stroke .3s; }
.sim-gauge .g-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.sim-gauge .g-pct { font-size: 23px; font-weight: 600; letter-spacing: -.02em; font-variant-numeric: tabular-nums; line-height: 1; color: #18181b; }
:global(.dark) .sim-gauge .g-pct { color: #f4f4f5; }
.sim-gauge .g-cap { font-size: 9px; color: #a1a1aa; margin-top: 3px; letter-spacing: .04em; }

.sim-band { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; margin-bottom: 7px; }
.sim-eyebrow { font-size: 11px; font-weight: 500; letter-spacing: .02em; color: #059669; margin-bottom: 3px; }
:global(.dark) .sim-eyebrow { color: #34d399; }
.sim-title { margin: 0 0 5px; font-size: 14.5px; font-weight: 600; line-height: 1.32; color: #18181b; }
:global(.dark) .sim-title { color: #f4f4f5; }
.sim-prev { margin: 0; font-size: 12px; font-weight: 300; color: #71717a; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
:global(.dark) .sim-prev { color: #a1a1aa; }
.sim-foot { display: flex; align-items: center; gap: 10px; margin-top: 13px; padding-top: 12px; border-top: 1px solid #e4e4e7; }
:global(.dark) .sim-foot { border-color: #3f3f46; }

.sim-mini { display: flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; padding: 8px 10px; border: 1px solid #e4e4e7; border-radius: 11px; background: #fff; margin-bottom: 6px; transition: border-color .15s, background .15s; }
:global(.dark) .sim-mini { background: #1b1b1f; border-color: #3f3f46; }
.sim-mini:hover { border-color: color-mix(in srgb, #10b981 40%, #e4e4e7); background: #f4f4f5; }
:global(.dark) .sim-mini:hover { background: rgba(39,39,42,.5); }
.sim-mini-title { font-size: 12.5px; font-weight: 500; line-height: 1.3; color: #27272a; display: -webkit-box; -webkit-line-clamp: 1; line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
:global(.dark) .sim-mini-title { color: #e4e4e7; }
.sim-bar { width: 44px; height: 4px; border-radius: 9999px; background: #ececed; overflow: hidden; display: inline-block; }
:global(.dark) .sim-bar { background: #2a2a2e; }
.sim-fill { display: block; height: 100%; border-radius: 9999px; background: #fbbf24; transition: width .35s cubic-bezier(.2,.7,.3,1); }

.sim-title :deep(mark), .sim-mini-title :deep(mark) { background: rgba(245,158,11,.12); color: #f59e0b; border-radius: 3px; padding: 0 1px; }
</style>
