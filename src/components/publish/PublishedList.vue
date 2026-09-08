<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import axios from 'axios'
import { publishmentApi } from '@/services/publishmentApi'
import type { PublishmentListItem, PublishmentSort, PublishmentVisibility } from '@/types/publish'
import { useTeamStore } from '@/stores/teamStore'
import { formatAbsolute } from '@/utils/timeAgo'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { ArrowTopRightOnSquareIcon } from '@heroicons/vue/24/outline'

const teamStore = useTeamStore()

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

const visibilityOptions: { value: PublishmentVisibility | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PUBLIC', label: 'Public' },
  { value: 'UNLISTED', label: 'Unlisted' },
]

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
      limit: 20,
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

const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  load()
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasNext.value && !loading.value) load(true)
    },
    { rootMargin: '200px' },
  )
  if (sentinel.value) observer.observe(sentinel.value)
})
onUnmounted(() => observer?.disconnect())

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
</script>

<template>
  <div>
    <!-- 발행물은 워크스페이스 단위가 아니다(BE 에 필터 없음) — 오해하지 않게 밝혀둔다. -->
    <p class="text-[11px] text-zinc-400 dark:text-zinc-600 mb-4">Everything you've published, across all workspaces.</p>

    <!-- 툴바 한 줄: 공개 범위 · 정렬 · 검색. 케이스의 status/severity 와는 다른 축이다. -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-3 mb-6">
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="opt in visibilityOptions"
          :key="opt.value"
          class="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
          :class="visibility === opt.value
            ? 'bg-emerald-600 text-white'
            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'"
          @click="visibility = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>

      <div class="flex items-center gap-1.5">
        <button
          v-for="opt in [{ value: 'published' as PublishmentSort, label: 'Latest' }, { value: 'views' as PublishmentSort, label: 'Views' }]"
          :key="opt.value"
          class="px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors"
          :class="sort === opt.value
            ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
            : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600'"
          @click="sort = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>

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
      <div v-if="items.length" class="divide-y divide-zinc-200 dark:divide-zinc-800">
        <article v-for="p in items" :key="p.slug" class="py-5">
          <div class="flex items-start gap-3">
            <div class="flex-1 min-w-0">
              <div v-if="p.tags.length" class="text-xs font-medium tracking-wide text-emerald-600 dark:text-emerald-500 mb-1">
                {{ p.tags.slice(0, 3).join(' / ') }}
              </div>

              <h3 class="text-base font-medium mb-1">
                <a
                  :href="p.publicUrl"
                  target="_blank"
                  rel="noopener"
                  class="group inline-flex items-start gap-1.5 text-zinc-800 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <span class="line-clamp-2">{{ p.title }}</span>
                  <ArrowTopRightOnSquareIcon class="w-3.5 h-3.5 mt-1 shrink-0 text-zinc-300 dark:text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                </a>
              </h3>

              <p v-if="p.summary" class="text-sm text-zinc-500 dark:text-zinc-400 font-light line-clamp-2 leading-relaxed">
                {{ p.summary }}
              </p>

              <!-- 상태 배지 — 원본과 어긋난 발행물을 조용히 넘기지 않는다. -->
              <div class="flex flex-wrap items-center gap-2 mt-2.5 text-[10px] font-medium">
                <span v-if="p.status === 'UNPUBLISHED'" class="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">Archived</span>
                <span v-if="p.visibility === 'UNLISTED'" class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Unlisted</span>
                <span v-if="p.sourceState === 'SOURCE_DELETED'" class="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">Source deleted</span>
                <span v-else-if="p.sourceStale" class="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">Source changed &middot; republish</span>
                <span v-if="p.version > 1" class="text-zinc-400 dark:text-zinc-500 font-mono">v{{ p.version }}</span>
              </div>

              <div class="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                <span>{{ p.stepCount }} steps · {{ p.solutionCount }} solution{{ p.solutionCount === 1 ? '' : 's' }}</span>
                <span class="text-zinc-300 dark:text-zinc-700">|</span>
                <span>{{ p.viewCount }} views</span>
                <span v-if="p.downloadCount">{{ p.downloadCount }} downloads</span>
              </div>
            </div>

            <div class="flex flex-col items-end gap-1 shrink-0 pt-0.5">
              <span class="text-xs text-zinc-400 dark:text-zinc-600">{{ formatAbsolute(p.publishedAt) }}</span>
              <router-link
                v-if="p.sourceState !== 'SOURCE_DELETED'"
                :to="caseRoute(p.originalCaseId)"
                class="text-[11px] font-mono text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >from #{{ p.originalCaseId }}</router-link>
              <span v-else class="text-[11px] font-mono text-zinc-300 dark:text-zinc-700">#{{ p.originalCaseId }}</span>
            </div>
          </div>
        </article>
      </div>

      <p v-else-if="q.trim() || visibility" class="text-sm text-zinc-400 dark:text-zinc-500 py-16 text-center">
        No published posts match those filters.
      </p>

      <div v-else class="flex flex-col items-center justify-center py-24 text-center border-t border-zinc-200 dark:border-zinc-800 mt-8">
        <h3 class="serif-title text-3xl text-zinc-800 dark:text-zinc-200 mb-6">Nothing Published Yet</h3>
        <p class="text-zinc-500 font-light text-sm max-w-md mx-auto leading-relaxed">
          Publish a case you’ve solved and share the whole write-up with a single link. Start from any case page.
        </p>
      </div>
    </template>

    <div ref="sentinel" class="h-1" />
    <LoadingSpinner v-if="loading && items.length" size="sm" class="py-4" />

    <p v-if="totalCount != null && items.length" class="text-[11px] text-zinc-400 dark:text-zinc-600 font-mono text-center pt-2">
      {{ items.length }} / {{ totalCount }} published
    </p>
  </div>
</template>
