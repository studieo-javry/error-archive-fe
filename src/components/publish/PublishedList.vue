<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import axios from 'axios'
import { publishmentApi } from '@/services/publishmentApi'
import type { PublishmentListItem, PublishmentSort, PublishmentVisibility } from '@/types/publish'
import { useTeamStore } from '@/stores/teamStore'
import { formatAbsolute } from '@/utils/timeAgo'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import LoadMoreButton from '@/components/common/LoadMoreButton.vue'
import ListEnd from '@/components/common/ListEnd.vue'
import {
  LinkIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowPathIcon,
  DocumentTextIcon,
} from '@heroicons/vue/24/outline'

const teamStore = useTeamStore()

// preview 모드(Profile): 툴바·무한스크롤 없이 상위 N건만 + "View all" 링크로 전용 페이지 유도.
// 기본(false)은 전체 리스트(검색/필터/무한스크롤) — 전용 페이지(/me/publications)에서 사용.
const props = defineProps<{ preview?: boolean }>()
const PREVIEW_LIMIT = 5

// 케이스 탭과 달리 검색어를 서버(`q`)로 보낸다 — 커서 페이징이라 클라이언트에서
// 걸러내면 아직 안 받아온 페이지를 놓친다. 그래서 목록이 검색창을 직접 갖는다.
const q = ref('')

const items = ref<PublishmentListItem[]>([])
const nextCursor = ref<string | null>(null)
const hasNext = ref(false)
const totalCount = ref<number | null>(null)
const loading = ref(false)
const loadError = ref('')

const visibility = ref<PublishmentVisibility | ''>('')
const sort = ref<PublishmentSort>('published')

async function load(append = false) {
  if (loading.value) return
  loading.value = true
  if (!append) loadError.value = ''
  try {
    const { data } = await publishmentApi.listMine({
      q: q.value.trim() || undefined,
      visibility: visibility.value || undefined,
      sort: sort.value,
      cursor: append ? nextCursor.value ?? undefined : undefined,
      limit: props.preview ? PREVIEW_LIMIT : 20,
    })
    items.value = append ? [...items.value, ...data.items] : data.items
    nextCursor.value = data.nextCursor
    hasNext.value = data.hasNext
    // totalCount 는 첫 페이지에서만 오므로 append 때 덮어쓰면 null 이 된다.
    if (!append) totalCount.value = data.totalCount
  } catch (e) {
    if (!append) {
      items.value = []
      hasNext.value = false
    }
    loadError.value = axios.isAxiosError(e)
      ? ((e.response?.data as { detail?: string })?.detail ?? "Couldn't load your published posts.")
      : "Couldn't load your published posts."
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
})
function loadMore() { if (hasNext.value && !loading.value) load(true) }

// 검색어는 타이핑마다 서버를 때리지 않도록 디바운스.
let queryTimer: ReturnType<typeof setTimeout> | undefined
watch(q, () => {
  clearTimeout(queryTimer)
  queryTimer = setTimeout(() => load(), 300)
})
onUnmounted(() => clearTimeout(queryTimer))

watch([visibility, sort], () => load())

/** 원본 케이스 링크. 응답에 워크스페이스가 없어 현재 slug 로 연다 — 케이스는 id 로 열리므로 동작한다. */
function caseRoute(caseId: number) {
  return { name: 'errorDetail', params: { slug: teamStore.currentSlug, id: caseId } }
}

// 공개 링크 복사 — 눌렀을 때 잠깐 Copied 로 바뀐다.
const copiedSlug = ref<string | null>(null)
async function copyLink(p: PublishmentListItem) {
  try {
    await navigator.clipboard.writeText(p.publicUrl)
    copiedSlug.value = p.slug
    setTimeout(() => {
      if (copiedSlug.value === p.slug) copiedSlug.value = null
    }, 1500)
  } catch { /* clipboard 미지원 — 조용히 무시 */ }
}

// 공개범위 · 정렬 select 공통 스타일.
const selectClass =
  'rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:border-zinc-300 focus:border-emerald-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
</script>

<template>
  <div>
    <!-- 발행물은 워크스페이스 단위가 아니다(BE 에 필터 없음) — 오해하지 않게 밝혀둔다. -->
    <p v-if="!preview" class="text-[11px] text-zinc-400 dark:text-zinc-600 mb-4">Everything you've published, across all workspaces.</p>

    <!-- 툴바 한 줄: 공개 범위(select) · 정렬(select) · 검색(케이스와 동일한 raw-input). preview 모드는 숨김. -->
    <div v-if="!preview" class="flex flex-wrap items-center gap-3 mb-6">
      <select v-model="visibility" :class="selectClass" aria-label="Visibility filter">
        <option value="">Visibility: All</option>
        <option value="PUBLIC">Public</option>
        <option value="UNLISTED">Unlisted</option>
      </select>
      <select v-model="sort" :class="selectClass" aria-label="Sort">
        <option value="published">Recently published</option>
        <option value="views">Most viewed</option>
      </select>
      <input
        v-model="q"
        type="text"
        placeholder="Search my published posts..."
        class="raw-input ml-auto w-full sm:w-56 text-sm"
      />
    </div>

    <p v-if="loadError" class="text-sm text-rose-600 dark:text-rose-400 py-6">{{ loadError }}</p>

    <LoadingSpinner v-else-if="loading && !items.length" size="lg" />

    <template v-else>
      <template v-if="items.length">
      <!-- preview(Profile) = A1: 번호 + 제목 + 메타, hover 시 Open / 초록 Copy 액션 페이드인 -->
      <div v-if="preview">
        <div
          v-for="(p, i) in items"
          :key="p.slug"
          class="group relative flex items-center gap-3 rounded-lg border-b border-zinc-100 px-2 py-2.5 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40"
        >
          <span class="w-5 shrink-0 text-center font-mono text-xs text-zinc-300 transition-colors group-hover:text-emerald-500 dark:text-zinc-600">{{ String(i + 1).padStart(2, '0') }}</span>
          <a
            :href="p.publicUrl"
            target="_blank"
            rel="noopener"
            class="min-w-0 flex-1 truncate text-[13.5px] font-medium text-zinc-700 transition-colors group-hover:text-emerald-600 dark:text-zinc-200 dark:group-hover:text-emerald-400"
          >{{ p.title }}</a>
          <!-- 평소: 조회수·공개범위 / hover: 같은 자리에 액션 페이드인 -->
          <span class="whitespace-nowrap font-mono text-[11px] text-zinc-400 transition-opacity group-hover:opacity-0 dark:text-zinc-500">{{ p.viewCount }} views · {{ p.visibility === 'PUBLIC' ? 'Public' : 'Unlisted' }}</span>
          <span class="pointer-events-none absolute right-2 flex translate-x-1 items-center gap-1.5 opacity-0 transition-all group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100">
            <a
              :href="p.publicUrl"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 font-mono text-[10.5px] text-zinc-500 transition-colors hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            ><LinkIcon class="h-3 w-3" />Open</a>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 font-mono text-[10.5px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
              @click="copyLink(p)"
            >
              <component :is="copiedSlug === p.slug ? CheckIcon : ClipboardDocumentIcon" class="h-3 w-3" />{{ copiedSlug === p.slug ? 'Copied' : 'Copy' }}
            </button>
          </span>
        </div>
      </div>
      <!-- full(전용 페이지 /me/publications) = 원본 카드 -->
      <div v-else class="grid gap-3">
        <article
          v-for="p in items"
          :key="p.slug"
          class="pub-card rounded-xl border border-zinc-200 bg-white px-5 py-[18px] transition-colors hover:border-zinc-300"
          :class="{ 'opacity-60': p.status === 'UNPUBLISHED' }"
        >
          <!-- 헤더: 제목 + slug / 오른쪽 배지들 -->
          <div class="flex items-start justify-between gap-3 mb-1.5">
            <div class="min-w-0 flex-1">
              <a
                :href="p.publicUrl"
                target="_blank"
                rel="noopener"
                class="block text-[15px] font-semibold leading-snug text-zinc-800 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors mb-1 line-clamp-2"
              >{{ p.title }}</a>
              <a
                :href="p.publicUrl"
                target="_blank"
                rel="noopener"
                class="inline-flex max-w-full items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] text-zinc-500 transition-colors hover:border-emerald-200 hover:text-emerald-600 dark:border-zinc-800 dark:bg-zinc-800/60 dark:hover:text-emerald-400"
              >
                <LinkIcon class="w-3 h-3 shrink-0" />
                <span class="truncate">/p/{{ p.slug }}</span>
              </a>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <span class="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[9.5px] font-bold tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/60">v{{ p.version }}</span>
              <span v-if="p.visibility === 'PUBLIC'" class="rounded bg-emerald-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">Public</span>
              <span v-else-if="p.visibility === 'UNLISTED'" class="rounded bg-amber-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Unlisted</span>
              <span v-if="p.status === 'UNPUBLISHED'" class="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">Archived</span>

              <!-- 원본 상태 배지 + 툴팁 -->
              <span
                v-if="p.sourceState === 'SOURCE_DELETED'"
                class="tip-wrap rounded border border-rose-200 bg-rose-50 px-2 py-0.5 font-mono text-[9px] font-bold text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
              >
                ⛔ Source deleted
                <span class="tip">The source case was deleted — the published snapshot is kept, but it can't be republished.</span>
              </span>
              <span
                v-else-if="p.sourceStale"
                class="tip-wrap rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[9px] font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
              >
                ⟳ Source updated
                <span class="tip">The source case changed after publishing — republish to reflect the latest (not available yet).</span>
              </span>
            </div>
          </div>

          <p v-if="p.summary || p.descriptionPreview" class="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400 line-clamp-2 my-2">{{ p.summary || p.descriptionPreview }}</p>

          <!-- 지표 + 태그 -->
          <div class="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 pb-2.5 font-mono text-[11.5px] text-zinc-500 dark:text-zinc-400">
            <span class="inline-flex items-center gap-1.5"><EyeIcon class="w-3 h-3 text-zinc-400 dark:text-zinc-600" /><b class="font-semibold text-zinc-800 dark:text-zinc-200">{{ p.viewCount }}</b> views</span>
            <span class="inline-flex items-center gap-1.5"><ArrowDownTrayIcon class="w-3 h-3 text-zinc-400 dark:text-zinc-600" /><b class="font-semibold text-zinc-800 dark:text-zinc-200">{{ p.downloadCount }}</b> downloads</span>
            <span><b class="font-semibold text-zinc-800 dark:text-zinc-200">{{ p.stepCount }}</b> steps</span>
            <span><b class="font-semibold text-zinc-800 dark:text-zinc-200">{{ p.solutionCount }}</b> solution{{ p.solutionCount === 1 ? '' : 's' }}</span>
            <div v-if="p.tags.length" class="ml-auto inline-flex flex-wrap items-center gap-1.5">
              <span
                v-for="t in p.tags.slice(0, 3)"
                :key="t"
                class="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-px font-mono text-[10px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/60"
              >#{{ t }}</span>
            </div>
          </div>

          <!-- 액션 + 타이밍 -->
          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-zinc-200 pt-3 dark:border-zinc-800">
            <div class="flex items-center gap-1.5">
              <a :href="p.pdfUrl" target="_blank" rel="noopener" class="pub-btn"><ArrowDownTrayIcon class="w-3 h-3" />PDF</a>
              <!-- Markdown 내보내기 — 도입 예정(비활성). 기능 출시 시 활성화. -->
              <span class="pub-btn pub-btn-disabled pub-btn-soon" title="Markdown 내보내기 · 도입 예정"><DocumentTextIcon class="w-3 h-3" />MD<em>soon</em></span>
              <button type="button" class="pub-btn pub-btn-primary" @click="copyLink(p)">
                <component :is="copiedSlug === p.slug ? CheckIcon : ClipboardDocumentIcon" class="w-3 h-3" />
                {{ copiedSlug === p.slug ? 'Copied' : 'Copy link' }}
              </button>
              <!-- 재발행: 원본 수정됨(stale)일 때만 노출. 콘텐츠 재발행 API 미제공 → 비활성 + 툴팁. -->
              <span
                v-if="p.sourceStale && p.sourceState !== 'SOURCE_DELETED'"
                class="tip-wrap pub-btn pub-btn-disabled"
              >
                <ArrowPathIcon class="w-3 h-3" />Republish
                <span class="tip">Republishing (creating a fresh snapshot) isn't available yet.</span>
              </span>
            </div>

            <div class="flex items-center gap-3 font-mono text-[10.5px] text-zinc-400 dark:text-zinc-600">
              <router-link
                v-if="p.sourceState !== 'SOURCE_DELETED'"
                :to="caseRoute(p.originalCaseId)"
                class="border-r border-zinc-200 pr-3 hover:text-emerald-600 dark:border-zinc-700 dark:hover:text-emerald-400 transition-colors"
              >from #{{ p.originalCaseId }}</router-link>
              <span v-else class="border-r border-zinc-200 pr-3 dark:border-zinc-700">#{{ p.originalCaseId }}</span>
              <span><b class="font-medium text-zinc-500 dark:text-zinc-400">published</b> {{ formatAbsolute(p.publishedAt) }}</span>
              <span><b class="font-medium text-zinc-500 dark:text-zinc-400">updated</b> {{ formatAbsolute(p.updatedAt) }}</span>
            </div>
          </div>
        </article>
      </div>
      </template>

      <p v-else-if="q.trim() || visibility" class="text-sm text-zinc-400 dark:text-zinc-500 py-16 text-center">
        No published posts match those filters.
      </p>

      <div v-else class="flex flex-col items-center justify-center py-24 text-center">
        <h3 class="serif-title text-3xl text-zinc-800 dark:text-zinc-200 mb-6">Nothing Published Yet</h3>
        <p class="text-zinc-500 font-light text-sm max-w-md mx-auto leading-relaxed">
          Publish a case you’ve solved and share the whole write-up with a single link. Start from any case page.
        </p>
      </div>
    </template>

    <!-- preview(Profile): 상위 N건만 보여주고 전체는 전용 페이지로. 더 있을 때만 "View all". -->
    <router-link
      v-if="preview && items.length && hasNext"
      :to="{ name: 'myPublications' }"
      class="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
    >
      View all publications
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
    </router-link>

    <template v-if="!preview && items.length">
      <LoadMoreButton v-if="hasNext" :loading="loading" @more="loadMore" />
      <ListEnd v-else :count="totalCount ?? items.length" />
    </template>
  </div>
</template>

<style scoped>
/* 카드 액션 버튼 — library 발행물 시안(outline chip) */
.pub-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 5px;
  border: 1px solid #e4e4e7;
  background: transparent;
  color: #71717a;
  font: 500 10.5px "JetBrains Mono", ui-monospace, Menlo, monospace;
  cursor: pointer;
  transition: color .12s, border-color .12s, background-color .12s;
}
.pub-btn:hover {
  border-color: #71717a;
  color: #18181b;
  background: #f4f4f5;
}
.pub-btn-primary:hover {
  border-color: #059669;
  color: #059669;
  background: rgba(16, 185, 129, .06);
}
/* 비활성(재발행) — 점선 + not-allowed, hover 는 색 안 변하고 툴팁만 */
.pub-btn-disabled {
  opacity: .5;
  cursor: not-allowed;
  border-style: dashed;
}
.pub-btn-disabled:hover {
  border-color: #e4e4e7;
  color: #71717a;
  background: transparent;
}
/* 도입 예정 태그(앰버 pill) — MD 버튼 전용 */
.pub-btn-soon { opacity: .72; }
.pub-btn-soon em {
  font-style: normal;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fcd9a0;
  padding: 0 4px;
  border-radius: 999px;
  margin-left: 2px;
}
html.dark .pub-btn-soon em {
  color: #fbbf24;
  background: rgba(251, 191, 36, .1);
  border-color: rgba(251, 191, 36, .3);
}

/* 호버 툴팁 (배지·비활성 버튼) — 테마 무관 다크 말풍선 */
.tip-wrap { position: relative; }
.tip {
  pointer-events: none;
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: none;
  width: max-content;
  max-width: 240px;
  white-space: normal;
  border-radius: 8px;
  background: #18181b;
  padding: 7px 10px;
  font: 400 11px/1.45 "Inter", sans-serif;
  color: #f4f4f5;
  box-shadow: 0 10px 26px rgba(0, 0, 0, .3);
}
.tip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  margin-top: -4px;
  width: 8px;
  height: 8px;
  background: #18181b;
}
.tip-wrap:hover .tip { display: block; }
</style>

<!--
  카드 호버 = playground G 확정 디자인(라이트·다크 공통): 테두리를 지우고 hover 시
  좌측 초록 액센트 바가 위→아래로 자라며 배경이 살짝 뜨고 padding-left 가 벌어진다.
  이 빌드(LightningCSS)는 <style scoped> 안의 :global(.dark) 를 드랍하므로 비-scoped
  블록에서 처리하고, 유틸리티(@layer utilities)보다 우선하도록 unlayered 로 둔다
  (그래서 <article> 의 border-zinc-200 / bg-white / hover:border-zinc-300 유틸을
  그대로 두어도 여기 값이 이긴다). 다크는 hover 배경만 밝게 오버라이드.
-->
<style>
.pub-card {
  position: relative;
  border-color: transparent;
  background: transparent;
  padding-left: 20px;
  transition: background-color .18s, padding-left .22s cubic-bezier(.4, 0, .2, 1);
}
.pub-card::before {
  content: "";
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: linear-gradient(#34d399, #059669);
  transform: scaleY(0);
  transform-origin: top;
  transition: transform .24s cubic-bezier(.4, 0, .2, 1);
}
.pub-card:hover {
  border-color: transparent;
  background: rgba(0, 0, 0, .025);
  padding-left: 24px;
}
.pub-card:hover::before {
  transform: scaleY(1);
}
/* 다크: hover 배경만 밝은 톤으로(나머지 좌측 바·padding 은 베이스 공유) */
html.dark .pub-card:hover {
  background: rgba(255, 255, 255, .025);
}

/* 액션 버튼 다크 (기존 :global(.dark) 가 빌드에서 드랍되던 버그 수정) */
html.dark .pub-btn {
  border-color: #27272a;
  color: #a1a1aa;
}
html.dark .pub-btn:hover {
  border-color: #a1a1aa;
  color: #e4e4e7;
  background: #232327;
}
html.dark .pub-btn-primary:hover {
  border-color: #10b981;
  color: #34d399;
  background: rgba(16, 185, 129, .1);
}
html.dark .pub-btn-disabled:hover {
  border-color: #27272a;
  color: #a1a1aa;
  background: transparent;
}
</style>
