<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTeamStore } from '@/stores/teamStore'
import type { RecentActivity, RecentActivityType } from '@/types/home'

const props = defineProps<{
  items: RecentActivity[]
  byType: Record<string, number>
  /** 본인 프로필인지 — 빈 상태에서 CTA 노출 여부. 기본 true(하위호환). */
  isOwn?: boolean
  /** 방문자 빈 상태 문구용 프로필 주인 이름. */
  ownerName?: string
}>()

const router = useRouter()
const teamStore = useTeamStore()

function goCreate() {
  router.push({ name: 'errorCreate', params: { slug: teamStore.currentSlug } })
}

// isOwn 은 optional — 미지정이면 본인으로 간주(하위호환).
const own = computed(() => props.isOwn !== false)

// ── type presentation ──
interface TypeMeta { badge: string; label: string; dot: string; badgeCls: string; hollow?: boolean }
const TYPE_META: Record<RecentActivityType, TypeMeta> = {
  CASE_RESOLVED: { badge: 'RESOLVED', label: 'Marked as resolved', dot: 'bg-emerald-500', badgeCls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  CASE_CREATED: { badge: 'CREATED', label: 'Created the case', dot: 'bg-emerald-500', badgeCls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  STEP_ADDED: { badge: 'STEP', label: 'Added a step', dot: 'bg-amber-500', badgeCls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  SOLUTION_REGISTERED: { badge: 'SOLUTION', label: 'Registered a solution', dot: 'bg-violet-500', badgeCls: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  COMMENT_POSTED: { badge: 'COMMENT', label: 'Left a comment', dot: 'bg-zinc-400', badgeCls: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400', hollow: true },
}
function meta(t: string): TypeMeta {
  return TYPE_META[t as RecentActivityType] ?? { badge: t, label: t, dot: 'bg-zinc-400', badgeCls: 'bg-zinc-500/10 text-zinc-500' }
}

// ── summary chips ──
const CHIP_ORDER = ['CASE_RESOLVED', 'CASE_PUBLISHED', 'SOLUTION_REGISTERED', 'STEP_ADDED', 'COMMENT_POSTED', 'CASE_CREATED']
const CHIP_LABEL: Record<string, string> = {
  CASE_RESOLVED: 'resolved', CASE_PUBLISHED: 'published', SOLUTION_REGISTERED: 'solutions',
  STEP_ADDED: 'steps', COMMENT_POSTED: 'comments', CASE_CREATED: 'created',
}
const chips = computed(() =>
  CHIP_ORDER.filter(t => (props.byType[t] ?? 0) > 0).map(t => ({ label: CHIP_LABEL[t] ?? t.toLowerCase(), count: props.byType[t] })),
)

// ── time / day helpers ──
function parse(iso: string): Date {
  return new Date(iso)
}
function shortAgo(iso: string): string {
  const s = Math.floor((Date.now() - parse(iso).getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}
const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
function dayHeader(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const that = new Date(d); that.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000)
  const md = `${that.getMonth() + 1}/${that.getDate()}`
  if (diff === 0) return `TODAY · ${md}`
  if (diff === 1) return `YESTERDAY · ${md}`
  return `${WD[that.getDay()]} · ${md}`
}

// ── grouping: day → case → activities ──
interface CaseGroup { caseId: number; caseTitle: string | null; dotType: string; activities: RecentActivity[] }
interface DayGroup { key: string; header: string; cases: CaseGroup[] }

const groups = computed<DayGroup[]>(() => {
  const days = new Map<string, { header: string; cases: Map<number, CaseGroup> }>()
  for (const a of props.items) {
    const d = parse(a.occurredAt)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!days.has(key)) days.set(key, { header: dayHeader(d), cases: new Map() })
    const cases = days.get(key)!.cases
    if (!cases.has(a.caseId)) cases.set(a.caseId, { caseId: a.caseId, caseTitle: a.caseTitle, dotType: a.type, activities: [] })
    cases.get(a.caseId)!.activities.push(a)
  }
  return [...days.entries()].map(([key, v]) => ({ key, header: v.header, cases: [...v.cases.values()] }))
})

function openCase(caseId: number) {
  router.push({ name: 'errorDetail', params: { slug: teamStore.currentSlug, id: caseId } })
}
</script>

<template>
  <section>
    <!-- header: title + summary chips -->
    <div class="flex items-center justify-between gap-4 mb-6">
      <h2 class="text-lg font-light serif-title text-zinc-800 dark:text-zinc-100">Recent activities</h2>
      <div v-if="chips.length" class="flex items-center gap-1.5">
        <span
          v-for="c in chips"
          :key="c.label"
          class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700/70 text-[11px] text-zinc-500 dark:text-zinc-400"
        >
          <span class="font-medium text-zinc-700 dark:text-zinc-200">{{ c.count }}</span>{{ c.label }}
        </span>
      </div>
    </div>

    <!-- day groups -->
    <div class="space-y-8">
      <!-- empty: owner sees a CTA, visitors see a neutral line -->
      <div v-if="!groups.length" class="text-center py-6">
        <div
          class="w-14 h-14 mx-auto mb-3.5 rounded-2xl flex items-center justify-center"
          :class="own ? 'bg-emerald-50 dark:bg-emerald-900/25 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500'"
        >
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
        </div>
        <template v-if="own">
          <p class="text-sm font-medium text-zinc-800 dark:text-zinc-100">No activity yet</p>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-4 max-w-xs mx-auto">Create a case and log steps or solutions — they'll show up here on your timeline.</p>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline group"
            @click="goCreate"
          >
            Create a case
            <svg class="w-4 h-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </template>
        <template v-else>
          <p class="text-sm font-medium text-zinc-800 dark:text-zinc-100">No activity yet</p>
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{{ ownerName || 'This user' }} hasn't logged any activity yet.</p>
        </template>
      </div>

      <div v-for="day in groups" :key="day.key">
        <div class="flex items-center gap-2 mb-3">
          <span class="w-2 h-2 rounded-[3px] bg-emerald-500" />
          <span class="text-[11px] font-mono tracking-widest text-emerald-600 dark:text-emerald-400">{{ day.header }}</span>
        </div>

        <ul class="ml-1 border-l border-zinc-200 dark:border-zinc-800 space-y-6">
          <li v-for="c in day.cases" :key="c.caseId" class="relative pl-6">
            <!-- timeline dot -->
            <span
              class="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full"
              :class="meta(c.dotType).hollow
                ? 'border-2 border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900'
                : meta(c.dotType).dot"
            />

            <!-- case header -->
            <button type="button" class="group flex items-baseline gap-2 text-left" @click="openCase(c.caseId)">
              <span class="text-xs font-mono text-zinc-400 dark:text-zinc-500 shrink-0">#{{ c.caseId }}</span>
              <span class="text-sm text-zinc-700 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-1">
                {{ c.caseTitle ?? 'Untitled case' }}
              </span>
            </button>

            <!-- activities under the case -->
            <div
              v-for="(a, i) in c.activities"
              :key="i"
              class="flex items-center gap-2.5 mt-2"
            >
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wide uppercase" :class="meta(a.type).badgeCls">
                <template v-if="a.type === 'CASE_RESOLVED'">✓ </template>{{ meta(a.type).badge }}
              </span>
              <span class="text-[13px] text-zinc-500 dark:text-zinc-400">{{ meta(a.type).label }}</span>
              <span class="ml-auto text-[11px] font-mono text-zinc-400 dark:text-zinc-600 shrink-0">{{ shortAgo(a.occurredAt) }}</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
