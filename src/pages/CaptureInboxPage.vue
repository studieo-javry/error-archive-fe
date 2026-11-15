<script setup lang="ts">
/**
 * Capture Inbox — 개인·비공개. AI 가 남긴 문제 해결 과정을 검토하고 내 Case 로 남긴다.
 * 탭: 검토 대기(queue) / 검토 이력(history). ?tab 으로 공유·새로고침 가능.
 *  - 검토 대기: GET /captures (cursor)   - 검토 이력: GET /captures/history (status 필터, cursor)
 * 검색은 "불러온 목록 안에서만" 동작(서버 재질의 없음) — 목업과 동일.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CapIcon from '@/components/capture/CapIcon.vue'
import { captureApi } from '@/services/captureApi'
import type { Capture, CaptureHistoryItem, CaptureStatus } from '@/types/capture'
import { CAPTURE_STATE_LABELS } from '@/utils/captureLabels'

const route = useRoute()
const router = useRouter()

type Tab = 'queue' | 'history'
const tab = computed<Tab>(() => (route.query.tab === 'history' ? 'history' : 'queue'))

const queueItems = ref<Capture[]>([])
const historyItems = ref<CaptureHistoryItem[]>([])
const cursor = ref<string | null>(null)
const hasNext = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref(false)
const query = ref('')
const historyFilter = ref<CaptureStatus | ''>('')

// 화면에 뜬 항목(검색은 로드된 것만 필터).
interface Row {
  captureUuid: string
  status: CaptureStatus
  title: string
  project: string
  updatedAt: string
  symptom: string | null
  caseId: number | null
}

const rows = computed<Row[]>(() => {
  const base: Row[] =
    tab.value === 'queue'
      ? queueItems.value.map((c) => ({
          captureUuid: c.captureUuid,
          status: c.status,
          title: c.title ?? '(제목 없음)',
          project: c.project ?? '',
          updatedAt: c.updatedAt,
          symptom: c.content.symptom ?? null,
          caseId: null,
        }))
      : historyItems.value.map((c) => ({
          captureUuid: c.captureUuid,
          status: c.status,
          title: c.title ?? '(제목 없음)',
          project: c.project ?? '',
          updatedAt: c.updatedAt,
          symptom: null,
          caseId: c.caseId ?? null,
        }))
  const q = query.value.trim().toLowerCase()
  return q ? base.filter((r) => `${r.title} ${r.project}`.toLowerCase().includes(q)) : base
})

const loadedCount = computed(() => (tab.value === 'queue' ? queueItems.value.length : historyItems.value.length))

async function load() {
  loading.value = true
  loadError.value = false
  cursor.value = null
  try {
    if (tab.value === 'queue') {
      const { data } = await captureApi.reviewQueue()
      queueItems.value = data.items
      cursor.value = data.nextCursor ?? null
      hasNext.value = data.hasNext
    } else {
      const { data } = await captureApi.history(historyFilter.value || null)
      historyItems.value = data.items
      cursor.value = data.nextCursor ?? null
      hasNext.value = data.hasNext
    }
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || !hasNext.value || !cursor.value) return
  loadingMore.value = true
  try {
    if (tab.value === 'queue') {
      const { data } = await captureApi.reviewQueue(cursor.value)
      queueItems.value.push(...data.items)
      cursor.value = data.nextCursor ?? null
      hasNext.value = data.hasNext
    } else {
      const { data } = await captureApi.history(historyFilter.value || null, cursor.value)
      historyItems.value.push(...data.items)
      cursor.value = data.nextCursor ?? null
      hasNext.value = data.hasNext
    }
  } catch {
    /* 더보기 실패는 조용히 — 다음 시도 가능 */
  } finally {
    loadingMore.value = false
  }
}

// 탭/필터 변경 시 재로딩. 탭이 바뀌면 검색어도 초기화.
watch(tab, () => {
  query.value = ''
  historyFilter.value = ''
  load()
})
watch(historyFilter, load)
load()

function setTab(next: Tab) {
  if (next === tab.value) return
  router.replace({ name: 'captureInbox', query: next === 'queue' ? {} : { tab: next } })
}
function open(uuid: string) {
  router.push({ name: 'captureReview', params: { uuid } })
}
function goConnections() {
  router.push({ name: 'settingsIntegrations' })
}

function shortDate(iso: string): string {
  return iso.slice(0, 10).replaceAll('-', '.')
}
function stateTone(s: CaptureStatus): string {
  return s === 'READY_FOR_REVIEW' ? 'green' : s === 'IMPORTED' ? 'blue' : ''
}
function metaText(r: Row): string {
  if (r.status === 'IMPORTED') return r.caseId != null ? `Case #${r.caseId}` : '반영됨'
  if (r.status === 'DISCARDED') return '원본 기록 보관됨'
  return '검토 전 · 나만 볼 수 있음'
}

const HISTORY_FILTERS: { value: CaptureStatus | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'IMPORTED', label: '반영 완료' },
  { value: 'DISCARDED', label: '폐기됨' },
]
</script>

<template>
  <div class="cap page">
    <div class="heading">
      <div>
        <div class="eyebrow">AGENT CAPTURE ASSISTANT</div>
        <h1 class="serif page-title">Capture Inbox</h1>
        <p class="subtitle">AI가 남긴 문제 해결 과정을 검토하고, 내 경험으로 남겨보세요.</p>
      </div>
      <div class="heading-actions">
        <button type="button" class="btn" @click="goConnections"><CapIcon name="link" />연결 관리</button>
      </div>
    </div>

    <div v-if="tab === 'queue'" class="intro">
      <div class="intro-icon"><CapIcon name="inbox" /></div>
      <div class="grow">
        <h3>기록은 AI가, 최종 확인은 내가.</h3>
        <p class="small muted">완료된 기록을 골라 수정하면 개인 비공개 Case로 저장됩니다.</p>
      </div>
    </div>

    <!-- 탭 -->
    <div class="cap-tabs" role="tablist">
      <button role="tab" :aria-selected="tab === 'queue'" class="cap-tab" :class="{ active: tab === 'queue' }" @click="setTab('queue')">
        검토 대기<span v-if="tab === 'queue' && !loading && queueItems.length" class="cap-tab-count">{{ queueItems.length }}</span>
      </button>
      <button role="tab" :aria-selected="tab === 'history'" class="cap-tab" :class="{ active: tab === 'history' }" @click="setTab('history')">
        검토 이력
      </button>
    </div>

    <!-- 로딩 -->
    <div v-if="loading" class="card">
      <div class="loading" style="width: 60%" />
      <div class="loading" style="width: 90%" />
      <div class="loading" style="width: 35%" />
      <p class="small muted">기록을 불러오고 있어요…</p>
    </div>

    <!-- 조회 실패 -->
    <div v-else-if="loadError" class="notice rose" role="alert">
      검토함을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.<br />
      <button type="button" class="btn small" @click="load"><CapIcon name="refresh" />다시 불러오기</button>
    </div>

    <template v-else>
      <!-- 도구 모음 -->
      <div class="cap-tools">
        <div class="row wrap">
          <template v-if="tab === 'history'">
            <button
              v-for="f in HISTORY_FILTERS"
              :key="f.value || 'all'"
              type="button"
              class="btn small"
              :class="{ primary: historyFilter === f.value }"
              @click="historyFilter = f.value"
            >{{ f.label }}</button>
          </template>
          <span v-else class="small muted">검토 대기 {{ loadedCount }}건</span>
        </div>
        <label class="search">
          <CapIcon name="search" />
          <input v-model="query" class="raw" aria-label="불러온 기록 검색" placeholder="제목, 프로젝트 검색…" />
        </label>
      </div>

      <!-- 목록 -->
      <div v-if="rows.length" class="cap-list">
        <article v-for="r in rows" :key="r.captureUuid" class="capture-row">
          <div class="row-main" @click="open(r.captureUuid)">
            <div class="meta" style="margin-bottom: 7px">
              <span class="badge" :class="stateTone(r.status)">{{ CAPTURE_STATE_LABELS[r.status] }}</span>
              <span>{{ r.project }}</span>
            </div>
            <button type="button" class="row-title" @click.stop="open(r.captureUuid)">{{ r.title }}</button>
            <p v-if="tab === 'queue' && r.symptom" class="excerpt">{{ r.symptom }}</p>
            <div class="meta">
              <span>{{ shortDate(r.updatedAt) }}</span><span>·</span><span>{{ metaText(r) }}</span>
            </div>
          </div>
          <button type="button" class="btn small" @click="open(r.captureUuid)">
            <span>{{ tab === 'history' ? '기록 보기' : '검토하기' }}</span> <CapIcon name="arrow" />
          </button>
        </article>
      </div>

      <!-- 빈 상태 -->
      <div v-else class="empty">
        <div class="empty-icon"><CapIcon name="inbox" /></div>
        <template v-if="query">
          <h2 class="serif">No matching records</h2>
          <p>검색어와 일치하는 기록이 없어요. 검색은 불러온 목록 안에서만 동작합니다.</p>
          <button type="button" class="btn primary" @click="query = ''">검색 초기화</button>
        </template>
        <template v-else-if="tab === 'history'">
          <h2 class="serif">A little history, soon.</h2>
          <p>검토한 기록은 이곳에 쌓입니다. 검토 대기함에서 첫 기록을 확인해 보세요.</p>
          <button type="button" class="btn primary" @click="setTab('queue')">검토 대기함으로</button>
        </template>
        <template v-else>
          <h2 class="serif">All caught up.</h2>
          <p>아직 검토할 기록이 없어요. Claude Code와 연결하면 오류를 조사하고 해결한 과정을 초안으로 받을 수 있어요.</p>
          <button type="button" class="btn primary" @click="goConnections">연결 상태 확인</button>
        </template>
      </div>

      <!-- 더 보기 -->
      <div v-if="rows.length" class="list-footer">
        <button v-if="hasNext && !query" type="button" class="btn small" :disabled="loadingMore" @click="loadMore">
          <span v-if="loadingMore" class="spinner" />기록 더 보기 <CapIcon name="down" />
        </button>
        <span v-else-if="!query" class="small soft">불러온 기록을 모두 확인했어요.</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 탭·도구·목록 — 목업 .tabs/.tools/.list/.capture-row 를 이 페이지 범위로. */
.cap-tabs { display: flex; align-items: center; gap: 24px; border-bottom: 1px solid var(--line); margin-bottom: 24px; overflow: auto; }
.cap-tab { background: none; border: 0; border-bottom: 2px solid transparent; padding: 12px 0 14px; color: var(--muted); font-size: 13px; white-space: nowrap; cursor: pointer; }
.cap-tab.active { color: var(--text); border-bottom-color: var(--green); font-weight: 600; }
.cap-tab-count { margin-left: 6px; color: var(--green); font-size: 11px; }
.cap-tools { display: flex; align-items: center; gap: 16px; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; }
.cap-tools .search { display: flex; align-items: center; gap: 8px; width: 270px; max-width: 100%; }
.cap-tools .search svg { width: 16px; color: var(--soft); }
.cap-tools .raw { border: 0; border-bottom: 1px solid var(--line); border-radius: 0; background: transparent; padding: 8px 0; outline: 0; color: var(--text); width: 100%; }
.cap-tools .raw:focus { border-color: var(--accent); }
.cap-list { border-top: 1px solid var(--line); }
.capture-row { position: relative; padding: 24px 6px 24px 0; border-bottom: 1px solid var(--line); display: flex; gap: 20px; align-items: center; }
.capture-row .row-main { flex: 1; min-width: 0; cursor: pointer; }
.capture-row:hover .row-title { color: var(--green); }
.row-title { font-size: 16px; font-weight: 500; line-height: 1.6; display: block; border: 0; background: none; text-align: left; padding: 0; transition: color 0.15s; cursor: pointer; color: var(--text); }
.excerpt { font-size: 12px; color: var(--muted); margin: 5px 0 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 700px; }
.meta { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 11px; flex-wrap: wrap; }
.list-footer { text-align: center; padding: 25px; font-size: 11px; color: var(--soft); }
@media (max-width: 560px) {
  .capture-row { gap: 10px; padding: 20px 0; }
  .excerpt { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .cap-tools .search { width: 100%; }
}
</style>
