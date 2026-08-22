<script setup lang="ts">
import { computed, reactive, ref, watch, nextTick, onMounted } from 'vue'
import type { GrassDay, GrassBestDay } from '@/services/insightApi'

const props = defineProps<{
  days: GrassDay[]
  bestDay: GrassBestDay | null
}>()

// Parse a YYYY-MM-DD string as a *local* date (avoids UTC weekday drift).
function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

type Cell = { blank: true } | { blank: false; date: string; count: number; score: number; level: number }

// Pad leading blanks so the first real day lands on its weekday row (GitHub-style columns).
const cells = computed<Cell[]>(() => {
  const ds = props.days
  if (!ds.length) return []
  const pad = parseYMD(ds[0].date).getDay()
  const arr: Cell[] = []
  for (let i = 0; i < pad; i++) arr.push({ blank: true })
  for (const d of ds) arr.push({ blank: false, date: d.date, count: d.count, score: d.score, level: d.level })
  return arr
})

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthLabels = computed(() => {
  const out: { label: string; left: number }[] = []
  const cs = cells.value
  const cols = Math.ceil(cs.length / 7)
  let last = -1
  for (let c = 0; c < cols; c++) {
    let rep: Cell | null = null
    for (let r = 0; r < 7; r++) {
      const cell = cs[c * 7 + r]
      if (cell && !cell.blank) { rep = cell; break }
    }
    if (!rep || rep.blank) continue
    const m = parseYMD(rep.date).getMonth()
    if (m !== last) { out.push({ label: MONTHS[m], left: c * 16 }); last = m }
  }
  return out
})

const bestLabel = computed(() =>
  props.bestDay ? `CRITICAL PEAK · ${props.bestDay.date} [${props.bestDay.score} PTS]` : '',
)

const tip = reactive({ show: false, x: 0, y: 0, text: '' })

function onEnter(e: MouseEvent, c: Extract<Cell, { blank: false }>) {
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  tip.text = `${c.date} • ${c.count} actions (${c.score} pts)`
  tip.x = r.left + r.width / 2
  tip.y = r.top - 8
  tip.show = true
  if (c.score > 0) detonate(el, c.score)
}

function onLeave() {
  tip.show = false
}

// The grid runs oldest -> newest, so today sits at the far right. Default the horizontal
// scroll to the end; otherwise the panel opens on data from a year ago.
const gridWrap = ref<HTMLElement | null>(null)
async function scrollToToday() {
  await nextTick()
  const el = gridWrap.value
  if (el) el.scrollLeft = el.scrollWidth
}
onMounted(scrollToToday)
watch(() => props.days, scrollToToday)

// Bomb hover: a shockwave ring blooms from the cell, scaled by the day's density.
// High-density days also nudge the whole scroll panel for kinetic feedback.
function detonate(cellEl: HTMLElement, score: number) {
  const wave = document.createElement('div')
  wave.className = 'ins-shock'
  let scale = 3, time = 0.45, shadow = 8
  if (score > 20) { scale = 6.5; time = 0.65; shadow = 24 }
  else if (score > 10) { scale = 5; time = 0.55; shadow = 16 }
  else if (score > 4) { scale = 4; time = 0.5; shadow = 12 }
  wave.style.setProperty('--ins-blast-scale', String(scale))
  wave.style.setProperty('--ins-blast-shadow', `${shadow}px`)
  wave.style.animationDuration = `${time}s`
  cellEl.appendChild(wave)
  wave.addEventListener('animationend', () => wave.remove(), { once: true })

  if (score > 10) {
    const main = document.querySelector('main')
    if (main) {
      main.classList.remove('ins-quake')
      void (main as HTMLElement).offsetWidth
      ;(main as HTMLElement).style.setProperty('--ins-quake-time', score > 20 ? '0.35s' : '0.2s')
      main.classList.add('ins-quake')
      main.addEventListener('animationend', () => main.classList.remove('ins-quake'), { once: true })
    }
  }
}
</script>

<template>
  <div class="ins-heat border border-zinc-200 bg-white dark:border-zinc-800/60 dark:bg-[#18181b]/50 rounded-xl p-8 shadow-sm transition-colors">
    <div class="flex justify-between items-center mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-4 transition-colors">
      <span class="text-xs text-zinc-500 dark:text-zinc-300 font-light tracking-wide">Resolution Heatmap</span>
      <span class="text-[10px] font-mono text-red-500 dark:text-red-400">{{ bestLabel }}</span>
    </div>

    <div class="flex gap-2">
      <div class="ins-day-labels mt-4 text-zinc-400 dark:text-zinc-500">
        <span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span>
      </div>
      <div ref="gridWrap" class="ins-grid-wrap w-full">
        <div class="ins-month-labels text-zinc-400 dark:text-zinc-500">
          <div v-for="m in monthLabels" :key="m.left" class="ins-month-label" :style="{ left: m.left + 'px' }">{{ m.label }}</div>
        </div>
        <div class="ins-heatmap">
          <div
            v-for="(c, i) in cells"
            :key="i"
            class="ins-cell"
            :class="c.blank ? 'ins-future' : [c.level ? 'ins-l' + c.level : '', c.score > 0 ? 'ins-has' : '']"
            @mouseenter="!c.blank && onEnter($event, c)"
            @mouseleave="onLeave"
          />
        </div>
      </div>
    </div>

    <div class="flex items-center gap-4 mt-8 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest justify-end">
      <span>Clear / less</span>
      <div class="flex gap-2">
        <div class="ins-swatch" style="background-color: var(--ins-l0)" />
        <div class="ins-swatch ins-l1" />
        <div class="ins-swatch ins-l2" />
        <div class="ins-swatch ins-l3" />
        <div class="ins-swatch ins-l4" />
      </div>
      <span>High density</span>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="tip.show" class="ins-tip" :style="{ left: tip.x + 'px', top: tip.y + 'px' }">{{ tip.text }}</div>
  </Teleport>
</template>

<!-- Global (unscoped): the tooltip is teleported to <body> and the shockwave/quake are
     created imperatively, so their styles must not be scoped. All classes are `ins-`
     prefixed to stay namespaced. -->
<style>
.ins-heat {
  --ins-l0: #e4e4e7;
  --ins-l1: #fca5a5;
  --ins-l2: #f87171;
  --ins-l3: #ef4444;
  --ins-l4: #dc2626;
  --ins-l4-glow: rgba(220, 38, 38, 0.6);
  --ins-hover: #dc2626;
}
.dark .ins-heat {
  --ins-l0: #27272a;
  --ins-l1: #7f1d1d;
  --ins-l2: #b91c1c;
  --ins-l3: #ef4444;
  --ins-l4: #ff2a4b;
  --ins-l4-glow: rgba(255, 42, 75, 0.85);
  --ins-hover: #ffffff;
}

.ins-day-labels,
.ins-month-labels {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.ins-day-labels {
  display: grid;
  grid-template-rows: repeat(7, 12px);
  gap: 4px;
  margin-right: 12px;
}
.ins-day-labels span { line-height: 12px; }
.ins-grid-wrap {
  overflow-x: auto;
  padding-bottom: 8px;
  /* Scrollbar fully hidden (rail + thumb); scrolling still works via wheel/trackpad. */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.ins-grid-wrap::-webkit-scrollbar { width: 0; height: 0; }
.ins-month-labels { display: flex; position: relative; height: 16px; margin-bottom: 8px; }
.ins-month-label { position: absolute; }
.ins-heatmap { display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 12px); gap: 4px; position: relative; }

.ins-swatch { width: 12px; height: 12px; border-radius: 2px; background-color: var(--ins-l0); }

.ins-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background-color: var(--ins-l0);
  cursor: pointer;
  position: relative;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.ins-cell.ins-l1,
.ins-swatch.ins-l1 { background-color: var(--ins-l1); box-shadow: inset 0 0 2px rgba(0, 0, 0, 0.05); }
.ins-cell.ins-l2,
.ins-swatch.ins-l2 { background-color: var(--ins-l2); box-shadow: 0 0 5px rgba(248, 113, 113, 0.4); }
.ins-cell.ins-l3,
.ins-swatch.ins-l3 { background-color: var(--ins-l3); box-shadow: 0 0 9px rgba(239, 68, 68, 0.5); }
.ins-cell.ins-l4,
.ins-swatch.ins-l4 { background-color: var(--ins-l4); box-shadow: 0 0 14px var(--ins-l4-glow), inset 0 0 3px rgba(255, 255, 255, 0.5); }
.dark .ins-cell.ins-l3,
.dark .ins-swatch.ins-l3 { box-shadow: 0 0 12px rgba(239, 68, 68, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); }
.dark .ins-cell.ins-l4,
.dark .ins-swatch.ins-l4 { box-shadow: 0 0 18px var(--ins-l4-glow), inset 0 0 3px #ffffff; border: 1px solid rgba(255, 255, 255, 0.2); }

.ins-cell.ins-future { background: transparent !important; cursor: default; box-shadow: none !important; border: none !important; }
.ins-cell.ins-future:hover { transform: none; }

.ins-cell:not(.ins-future):hover {
  transform: scale(1.25);
  z-index: 20;
  border: 1px solid rgba(161, 161, 170, 0.5);
}
.ins-cell.ins-has:hover {
  transform: scale(1.35);
  z-index: 30;
  border: 1px solid var(--ins-hover) !important;
  animation: ins-shake 0.15s infinite linear;
}
@keyframes ins-shake {
  0% { transform: scale(1.35) translate(0, 0); }
  25% { transform: scale(1.35) translate(-0.5px, 0.5px); }
  50% { transform: scale(1.35) translate(0.5px, -0.5px); }
  75% { transform: scale(1.35) translate(-0.5px, -0.5px); }
  100% { transform: scale(1.35) translate(0, 0); }
}

.ins-shock {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 12px;
  height: 12px;
  background: transparent;
  border: 2px solid var(--ins-l4);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(1);
  pointer-events: none;
  z-index: 40;
  animation: ins-blast 0.45s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
}
@keyframes ins-blast {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 1; border-color: var(--ins-hover); box-shadow: 0 0 4px var(--ins-hover); }
  50% { opacity: 0.8; border-color: var(--ins-l4); }
  100% { transform: translate(-50%, -50%) scale(var(--ins-blast-scale, 4.5)); opacity: 0; box-shadow: 0 0 var(--ins-blast-shadow, 16px) var(--ins-l4-glow); }
}

.ins-quake { animation: ins-quake-kf var(--ins-quake-time, 0.25s) cubic-bezier(0.36, 0.07, 0.19, 0.97) both; }
@keyframes ins-quake-kf {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(1px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-1.5px, 0, 0); }
  40%, 60% { transform: translate3d(1.5px, 0, 0); }
}

.ins-tip {
  position: fixed;
  transform: translate(-50%, -100%);
  background: #ffffff;
  color: #18181b;
  padding: 8px 14px;
  font-size: 11px;
  pointer-events: none;
  white-space: nowrap;
  z-index: 100;
  border: 1px solid #e4e4e7;
  font-family: "JetBrains Mono", monospace;
  border-radius: 6px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}
.dark .ins-tip {
  background: #1e1e24;
  color: #f4f4f5;
  border-color: rgba(239, 68, 68, 0.2);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.6);
}
</style>
