<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { publishmentApi } from '@/services/publishmentApi'
import type { PublicPublishmentItem } from '@/types/publish'
import { formatAbsolute } from '@/utils/timeAgo'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/composables/useAuth'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

// Explore = 공개(PUBLIC+LIVE) 발행물 쇼케이스(전역).
//  - 외부 방문자(세션 아예 없음) → 공개 헤더 + 히어로 + 피드 + 우측 레일(랜딩/SEO 유입·전환).
//  - 게스트(둘러보기)·회원 → 앱 사이드바 안에서 피드만. 게스트는 레이아웃상 "인증됨"으로 취급(데모=회원 동일).
// 데이터는 GET /publishments/public(무인증).
const router = useRouter()
const authStore = useAuthStore()
const { loginAsGuest } = useAuth()
const isAuthed = computed(() => authStore.isAuthenticated)

const items = ref<PublicPublishmentItem[]>([])
const loading = ref(false)
const loadError = ref('')
const query = ref('')
const sort = ref<'recent' | 'views'>('recent')
const showSearch = ref(false)
const toastMsg = ref('')
const guestBusy = ref(false)
const aboutDialog = ref<HTMLDialogElement | null>(null)
let toastTimer: number | undefined
let lastLoaded = 0

async function load(silent = false) {
  if (!silent) loading.value = true
  loadError.value = ''
  try {
    const { data } = await publishmentApi.listPublic({ limit: 60 })
    items.value = data
    lastLoaded = Date.now()
  } catch (e) {
    if (!silent) {
      items.value = []
      loadError.value = axios.isAxiosError(e)
        ? ((e.response?.data as { detail?: string })?.detail ?? "Couldn't load published posts.")
        : "Couldn't load published posts."
    }
  } finally {
    if (!silent) loading.value = false
  }
}

const visibleItems = computed(() => {
  const words = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = items.value.filter((p) => {
    if (!words.length) return true
    const hay = `${p.title} ${p.summary ?? ''} ${p.descriptionPreview ?? ''} ${p.tags.join(' ')} ${p.slug}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
  return [...filtered].sort((a, b) =>
    sort.value === 'views' ? b.viewCount - a.viewCount : b.publishedAt.localeCompare(a.publishedAt),
  )
})
const hasFilter = computed(() => !!query.value.trim())

function notify(msg: string) {
  toastMsg.value = msg
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toastMsg.value = '' }, 3500)
}
async function copyLink(p: PublicPublishmentItem) {
  try {
    await navigator.clipboard.writeText(p.publicUrl)
    notify('공개 링크를 복사했어요.')
  } catch {
    notify('복사할 링크: ' + p.publicUrl)
  }
}
function goLogin() { router.push({ name: 'login' }) }
function openAbout() { aboutDialog.value?.showModal() }
function closeAbout() { aboutDialog.value?.close() }
// 백드롭 클릭 시 닫기(네이티브 dialog 는 Esc 는 기본 처리).
function onAboutClick(e: MouseEvent) {
  if (e.target === aboutDialog.value) closeAbout()
}
function startFromAbout() { closeAbout(); goLogin() }
async function goGuest() {
  if (guestBusy.value) return
  guestBusy.value = true
  try {
    await loginAsGuest() // 성공 시 데모 워크스페이스로 이동
  } catch {
    guestBusy.value = false
    notify('데모 둘러보기를 시작할 수 없어요. 잠시 후 다시 시도해주세요.')
  }
}
function resetFilters() { query.value = ''; showSearch.value = false }
function toggleSearch() {
  showSearch.value = !showSearch.value
  if (showSearch.value) {
    requestAnimationFrame(() => (document.getElementById('ea-pub-search') as HTMLInputElement | null)?.focus())
  } else {
    query.value = ''
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
  const el = document.activeElement
  if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return
  e.preventDefault()
  showSearch.value = true
  requestAnimationFrame(() => (document.getElementById('ea-pub-search') as HTMLInputElement | null)?.focus())
}
// ③ 탭 복귀 시 조용히 최신 views 반영(10초 쓰로틀) — 카드가 새 탭으로 열려 재마운트가 안 되는 문제 보완.
function onVisibility() {
  if (document.visibilityState === 'visible' && Date.now() - lastLoaded > 10000) load(true)
}
onMounted(() => {
  load()
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('visibilitychange', onVisibility)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('visibilitychange', onVisibility)
  window.clearTimeout(toastTimer)
})
</script>

<template>
  <div class="ea-explore" :class="{ authed: isAuthed }">
    <!-- 외부 방문자 전용: 공개 헤더 -->
    <header v-if="!isAuthed" class="public-header">
      <div class="header-context">
        <a class="public-brand" href="#" @click.prevent><span class="serif-title">E</span><span class="brand-name">ErrorArchive</span></a>
        <div class="public-context"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c4 4 4 14 0 18M12 3c-4 4-4 14 0 18"/></svg>Explore</div>
      </div>
      <div class="header-right">
        <button class="header-text" type="button" aria-haspopup="dialog" @click="openAbout">서비스 소개</button>
        <button class="header-text" type="button" @click="goLogin">로그인</button>
        <button class="action-button public-demo" type="button" :disabled="guestBusy" @click="goGuest">
          <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7V5Z"/></svg>
          <span>{{ guestBusy ? '들어가는 중…' : '데모 둘러보기' }}</span>
        </button>
      </div>
    </header>

    <div class="page-shell" :class="{ 'has-public-intro': !isAuthed }">
      <!-- 외부 방문자 전용: 히어로 -->
      <section v-if="!isAuthed" class="hero" aria-labelledby="hero-title">
        <div>
          <p class="hero-eyebrow mono">A HOME FOR SOLVED ERRORS</p>
          <h2 id="hero-title">누군가의 시행착오가,<br>당신의 <em>해결책</em>이 되도록.</h2>
          <p class="hero-copy">증상부터 시도, 그리고 해결까지. <br>개발자들이 남긴 문제 해결의 과정을 함께 탐색하세요.</p>
        </div>
        <div class="hero-story" aria-label="ErrorArchive 의 기록 과정">
          <p class="story-caption mono">EVERY FIX HAS A STORY</p>
          <div class="story-item"><span class="story-icon"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6M8 13h8m-8 4h5"/></svg></span><div><strong>에러를 마주하고</strong><small>문제가 시작된 맥락과 증상</small></div></div>
          <div class="story-item"><span class="story-icon"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v12a4 4 0 0 0 4 4h3M5 9h8a4 4 0 0 1 4 4v3"/><circle cx="5" cy="4" r="2"/><circle cx="17" cy="18" r="2"/></svg></span><div><strong>해결의 실마리를 찾고</strong><small>시도한 방법과 확인한 근거</small></div></div>
          <div class="story-item"><span class="story-icon"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></span><div><strong>다음 사람에게 전해요</strong><small>검증한 해결책과 배운 것</small></div></div>
        </div>
      </section>

      <div class="public-explore-layout">
        <div class="explore-feed-content">
          <!-- 외부 방문자: 랜딩형 헤더(에디토리얼) -->
          <header v-if="!isAuthed" class="explore-head">
            <p class="section-eyebrow">Community / Publications</p>
            <div class="title-row">
              <h1 class="page-title serif-title">Explore</h1>
              <span class="scope-note"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c4 4 4 14 0 18M12 3c-4 4-4 14 0 18"/></svg>공개 아티클</span>
            </div>
            <p class="page-description">문제에서 해결까지, 개발자들이 남긴 기록.<br>시도와 발견이 담긴 공개 아티클을 둘러보세요.</p>
          </header>
          <!-- 로그인(게스트·회원): 앱 내 다른 페이지(Library 등)와 동일한 상단 -->
          <header v-else class="explore-head-app">
            <h1 class="app-title serif-title">Explore</h1>
            <p class="app-sub">Published write-ups shared by the community.</p>
          </header>

          <div class="feed-toolbar">
            <div class="feed-meta"><b class="feed-count">{{ visibleItems.length }}</b> publications</div>
            <div class="toolbar-actions">
              <div class="sort-seg" role="group" aria-label="발행물 정렬">
                <button type="button" :aria-pressed="sort === 'recent'" @click="sort = 'recent'">Recent</button>
                <button type="button" :aria-pressed="sort === 'views'" @click="sort = 'views'">Most read</button>
              </div>
              <button class="icon-button small-search-toggle" type="button" :aria-expanded="showSearch" aria-label="발행물 안에서 찾기" title="발행물 안에서 찾기" @click="toggleSearch"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg></button>
            </div>
          </div>

          <form v-show="showSearch" class="publication-search" role="search" @submit.prevent>
            <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
            <input id="ea-pub-search" v-model="query" type="search" aria-label="발행물 제목·요약·태그로 찾기" placeholder="발행물 제목·요약·태그로 좁히기" autocomplete="off">
            <button class="icon-button" type="button" aria-label="발행물 검색 닫기" @click="toggleSearch"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button>
          </form>

          <LoadingSpinner v-if="loading && !items.length" size="lg" />
          <p v-else-if="loadError" class="load-error">{{ loadError }}</p>
          <template v-else>
            <div class="grid">
              <article v-for="p in visibleItems" :key="p.slug" class="pub-card">
                <div class="c-top">
                  <div style="min-width:0;flex:1">
                    <a :href="p.publicUrl" target="_blank" rel="noopener" class="c-title">{{ p.title }}</a>
                    <a :href="p.publicUrl" target="_blank" rel="noopener" class="slug"><svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/></svg><span>/p/{{ p.slug }}</span></a>
                  </div>
                  <span class="badge-pub">Public</span>
                </div>
                <p v-if="p.summary || p.descriptionPreview" class="summary">{{ p.summary || p.descriptionPreview }}</p>
                <div class="metrics">
                  <span class="m"><svg fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg><b>{{ p.viewCount.toLocaleString() }}</b> views</span>
                  <span class="m"><b>{{ p.stepCount }}</b> steps</span>
                  <span class="m"><b>{{ p.solutionCount }}</b> solution{{ p.solutionCount === 1 ? '' : 's' }}</span>
                  <span v-if="p.tags.length" class="tags"><span v-for="t in p.tags.slice(0, 3)" :key="t">#{{ t }}</span></span>
                </div>
                <div class="c-foot">
                  <div class="acts">
                    <a :href="p.publicUrl" target="_blank" rel="noopener" class="pub-btn pub-btn-primary"><svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/></svg>Open</a>
                    <button type="button" class="pub-btn" @click="copyLink(p)"><svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"/></svg>Copy link</button>
                  </div>
                  <div class="when"><span v-if="p.author" class="au">{{ p.author }}</span><span><b>published</b> {{ formatAbsolute(p.publishedAt) }}</span></div>
                </div>
              </article>
            </div>

            <div v-if="!visibleItems.length" class="empty-state">
              <h3>{{ items.length ? '일치하는 발행물이 없어요.' : 'Nothing to Explore Yet' }}</h3>
              <p v-if="items.length">검색어를 지우고 다시 둘러보세요.</p>
              <p v-else>Public write-ups appear here as people publish the cases they've solved.</p>
              <button v-if="items.length" class="text-link" type="button" @click="resetFilters">전체 발행물 보기 <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-5-5 5 5-5 5"/></svg></button>
            </div>
            <p v-else class="list-end">{{ hasFilter ? '조건에 맞는 발행물을 모두 살펴봤어요.' : '공개된 발행물을 모두 살펴봤어요.' }}</p>

            <div v-if="!isAuthed" class="search-direction">
              <p>에러 메시지나 해결 중인 케이스를 찾고 있나요?<br>공개 케이스의 증상과 시도는 로그인 후 Search에서 찾아보세요.</p>
              <button class="text-link" type="button" @click="goLogin">로그인 <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-5-5 5 5-5 5"/></svg></button>
            </div>
          </template>
        </div>

        <!-- 외부 방문자 전용: 우측 레일 -->
        <aside v-if="!isAuthed" class="visitor-rail" aria-label="처음 방문하셨나요?">
          <p class="rail-note"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15"/></svg>공개된 기록은 가입 없이 읽을 수 있어요.</p>
          <section class="rail-join">
            <div class="rail-mark" aria-hidden="true"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/></svg></div>
            <h2>당신이 해결한 에러도<br>좋은 기록이 될 수 있어요.</h2>
            <p>흩어진 로그와 시도를 하나의 타임라인에.<br>나만의 해결 과정을 차곡차곡 남겨 보세요.</p>
            <button class="primary-button" type="button" @click="goLogin">나의 첫 기록 시작하기 <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button>
            <p class="join-note">GitHub 계정으로 간편하게 시작하세요.</p>
          </section>
          <section class="rail-guide">
            <h3>답만큼 중요한, 답을 찾는 과정</h3>
            <ul>
              <li><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>어떤 상황에서 문제가 발생했는지</span></li>
              <li><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>무엇을 시도하고, 어떻게 확인했는지</span></li>
              <li><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>마침내 어떤 방법으로 해결했는지</span></li>
            </ul>
            <button class="text-link rail-about" type="button" aria-haspopup="dialog" @click="openAbout">ErrorArchive 알아보기 <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button>
          </section>
        </aside>
      </div>

      <p v-if="!isAuthed" class="site-signoff">Today's error becomes tomorrow's weapon.</p>
    </div>

    <!-- 서비스 소개 모달 (외부 방문자 헤더/레일에서 호출) -->
    <dialog ref="aboutDialog" class="ui-dialog about-dialog" aria-labelledby="about-title" @click="onAboutClick">
      <button class="icon-button dialog-close" type="button" aria-label="닫기" @click="closeAbout"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button>
      <p class="dialog-eyebrow mono">ABOUT ERRORARCHIVE</p>
      <h2 id="about-title" class="serif-title">해결의 결과와 과정을<br>함께 남기는 곳.</h2>
      <p>ErrorArchive 는 개발 중 마주친 에러를 기록하고, 시도와 근거를 쌓아 해결의 과정을 공유하는 공간입니다.</p>
      <ol class="about-steps">
        <li><strong>01 · 맥락을 기록하세요</strong><p>에러 메시지, 로그, 발생 환경을 함께 남깁니다.</p></li>
        <li><strong>02 · 시도를 이어 가세요</strong><p>가설과 시도, 결과를 타임라인에 쌓습니다.</p></li>
        <li><strong>03 · 해결을 나누세요</strong><p>최종 해결책과 과정을 정리해 다른 개발자에게 전합니다.</p></li>
      </ol>
      <button class="primary-button" type="button" @click="startFromAbout">나의 기록 시작하기 <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button>
    </dialog>

    <div class="toast" :class="{ visible: toastMsg }" role="status" aria-live="polite">{{ toastMsg }}</div>
  </div>
</template>

<style scoped>
.ea-explore{
  --bg:#f7f7f5;--surface:#fff;--ink:#27272a;--muted:#71717a;--soft:#a1a1aa;--line:#e4e4e7;
  --green:#059669;--green-soft:#ecfdf5;--green-line:#cce5d5;--hover:#f4f4f5;--glass:rgba(255,255,255,.8);
  --shadow:0 12px 36px rgba(24,24,27,.1);
  background:var(--bg);color:var(--ink);min-height:100%;
}
.ea-explore :focus-visible{outline:2px solid var(--green);outline-offset:3px}
.ui-icon{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;flex:none}
.mono{font-family:"JetBrains Mono",ui-monospace,monospace}
.serif-title{font-family:"Fraunces","Nanum Myeongjo","Noto Serif KR",Georgia,serif;font-optical-sizing:auto;font-weight:400;letter-spacing:-.01em}

.icon-button{display:grid;place-items:center;width:36px;height:36px;padding:0;border:0;border-radius:12px;background:none;color:var(--muted);cursor:pointer}
.icon-button:hover{color:var(--ink);background:var(--hover)}
.icon-button .ui-icon{width:18px;height:18px}
.action-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:34px;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--ink);font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap}
.action-button:hover{border-color:var(--soft);background:var(--hover)}
.action-button:disabled{opacity:.6;cursor:default}
.action-button .ui-icon{width:14px;height:14px}
.action-primary{color:#fff;background:#059669;border-color:#059669}
.action-primary:hover{color:#fff;background:#047857;border-color:#047857}
.text-link{display:inline-flex;align-items:center;gap:6px;padding:0;border:0;background:none;color:var(--green);font-size:11px;line-height:1.5;text-decoration:none;cursor:pointer}
.text-link:hover{text-decoration:underline;text-underline-offset:4px}
.text-link .ui-icon{width:14px;height:14px}

.public-header{position:sticky;top:0;z-index:30;height:68px;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;background:var(--glass);backdrop-filter:blur(12px);border-bottom:1px solid rgba(0,0,0,.05)}
.header-context{display:flex;align-items:center;gap:12px;min-width:0}
.public-brand{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none}
.public-brand .serif-title{font-size:26px;color:#10b981;line-height:1}
.brand-name{font-size:16px;font-weight:700;letter-spacing:-.035em}
.public-context{display:flex;gap:8px;align-items:center;margin-left:15px;padding-left:24px;border-left:1px solid var(--line);font-size:11px;color:var(--green)}
.public-context .ui-icon{width:15px;height:15px}
.header-right{display:flex;align-items:center;gap:10px}
.header-text{border:0;background:none;color:var(--muted);font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap}
.header-text:hover{color:var(--ink)}
.public-demo .ui-icon{width:14px;height:14px}

.page-shell{width:100%;max-width:800px;margin:0 auto;padding:32px 24px 56px}
.page-shell.has-public-intro{max-width:1080px;padding-top:36px}
/* 로그인(게스트·회원): App 컨테이너(max-w-5xl p-10)에 그대로 얹혀 Library 등과 폭·여백 통일 */
.ea-explore.authed .page-shell{max-width:none;padding:0}
.explore-head-app{margin:0}
.app-title{font-size:24px;font-weight:300;line-height:1.3;letter-spacing:-.01em;color:var(--ink);margin:0 0 24px}
.app-sub{font-size:11px;color:var(--soft);margin:0 0 16px}

.hero{display:grid;grid-template-columns:minmax(0,720px) minmax(0,320px);gap:40px;padding:10px 0 34px;border-bottom:1px solid var(--line);align-items:center;--green:#047857;--green-line:#cce5d5;--green-soft:#eaf5ee}
.hero-eyebrow{display:flex;align-items:center;gap:9px;margin:0 0 15px;color:var(--green);font-size:10px;font-weight:500;letter-spacing:.12em}
.hero-eyebrow::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--green)}
.hero h2{font-size:36px;line-height:1.4;letter-spacing:-.045em;font-weight:600;margin:0;color:var(--ink);word-break:keep-all}
.hero h2 em{font-style:normal;color:var(--green)}
.hero-copy{margin:14px 0 0;font-size:13px;line-height:1.85;letter-spacing:-.02em;color:var(--muted);word-break:keep-all}
.hero-story{padding:5px 0 5px 25px;border-left:1px solid var(--line)}
.story-caption{font-size:9px;letter-spacing:.12em;color:var(--soft);margin:0 0 18px}
.story-item{position:relative;display:flex;gap:13px;align-items:center;padding:0 0 19px}
.story-item:last-child{padding-bottom:0}
.story-item:not(:last-child)::after{content:"";position:absolute;left:15px;top:34px;height:15px;border-left:1px dashed var(--green-line)}
.story-icon{height:32px;width:32px;display:grid;place-items:center;flex:none;border-radius:50%;border:1px solid var(--line);background:var(--bg);color:var(--muted)}
.story-icon .ui-icon{width:15px;height:15px}
.story-item:last-child .story-icon{border-color:var(--green-line);background:var(--green-soft);color:var(--green)}
.story-item strong{display:block;font-size:12px;font-weight:600;letter-spacing:-.025em;color:var(--ink)}
.story-item small{display:block;font-size:11px;line-height:1.5;color:var(--muted);margin-top:3px;letter-spacing:-.015em}

.public-explore-layout{display:block}
.has-public-intro .public-explore-layout{display:grid;grid-template-columns:minmax(0,720px) minmax(0,320px);gap:40px;padding-top:28px;align-items:start}
.explore-feed-content{min-width:0}
.explore-head{margin-bottom:27px}
.section-eyebrow{display:flex;align-items:center;gap:8px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:9px;color:var(--green);letter-spacing:.13em;font-weight:500;margin:0 0 13px;text-transform:uppercase}
.section-eyebrow::before{content:"";width:9px;height:1px;background:var(--green)}
.title-row{display:flex;align-items:baseline;justify-content:space-between;gap:15px}
.page-title{font-size:32px;line-height:1.25;margin:0;color:var(--ink)}
.scope-note{font-size:9px;color:var(--soft);letter-spacing:.01em;display:flex;align-items:center;gap:5px}
.scope-note .ui-icon{width:12px;height:12px}
.page-description{margin:12px 0 0;font-size:12px;color:var(--muted);line-height:1.8;letter-spacing:-.015em;word-break:keep-all}

.feed-toolbar{display:flex;align-items:center;justify-content:space-between;gap:15px;border-bottom:1px solid var(--line);min-height:41px;margin-bottom:13px;padding-bottom:11px}
.feed-meta{font-size:11px;color:var(--soft);letter-spacing:-.01em}
.feed-count{font-family:"JetBrains Mono",monospace;color:var(--ink);font-size:12px;font-weight:600}
.toolbar-actions{display:flex;align-items:center;gap:8px}
.sort-seg{display:inline-flex;background:var(--hover);border-radius:9px;padding:3px}
.sort-seg button{border:0;background:none;font:inherit;font-size:11px;color:var(--soft);padding:6px 12px;border-radius:7px;cursor:pointer;white-space:nowrap}
.sort-seg button:hover{color:var(--ink)}
.sort-seg button[aria-pressed="true"]{background:var(--surface);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08);font-weight:500}
.small-search-toggle{width:25px;height:25px;border-radius:6px}
.small-search-toggle .ui-icon{width:15px;height:15px}
.small-search-toggle[aria-expanded="true"]{background:var(--green-soft);color:var(--green)}
.publication-search{display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line);margin:0 0 16px;padding:6px 0 11px}
.publication-search>.ui-icon{width:16px;height:16px;color:var(--soft)}
.publication-search input{background:transparent;border:0;outline:none;padding:5px 0;color:var(--ink);font-size:12px;min-width:0;width:100%}
.publication-search input::placeholder{color:var(--soft)}
.publication-search input::-webkit-search-cancel-button{display:none}
.publication-search .icon-button{height:23px;width:23px}
.publication-search .icon-button .ui-icon{height:14px;width:14px}

.load-error{font-size:13px;color:#e11d48;padding:24px 4px}
.empty-state{padding:48px 20px;text-align:center;color:var(--muted)}
.empty-state h3{font-size:14px;font-weight:500;color:var(--ink)}
.empty-state p{font-size:12px;line-height:1.7;margin:8px 0 14px}
.list-end{font-size:10px;color:var(--soft);text-align:center;margin:23px 0 0}
.search-direction{display:flex;align-items:center;justify-content:space-between;gap:18px;border-top:1px solid var(--line);padding-top:19px;margin:28px 0 0}
.search-direction p{font-size:11px;color:var(--muted);line-height:1.8;margin:0;letter-spacing:-.015em}
.search-direction .text-link{flex:none}
.site-signoff{font-size:9px;color:var(--soft);text-align:center;margin:38px 0 0}

.visitor-rail{min-width:0;--green:#047857;--green-line:#cce5d5;--green-soft:#eaf5ee}
.rail-note{display:flex;align-items:center;gap:7px;margin:0 0 20px;height:28px;font-size:11px;color:var(--muted);letter-spacing:-.02em}
.rail-note .ui-icon{width:14px;height:14px;color:var(--green)}
.rail-join{border:1px solid var(--line);border-radius:12px;padding:25px 23px 22px;background:var(--surface)}
.rail-mark{width:32px;height:32px;border:1px solid var(--green-line);background:var(--green-soft);color:var(--green);border-radius:9px;display:grid;place-items:center;margin-bottom:18px}
.rail-mark svg{width:18px;height:18px}
.rail-join h2{margin:0;color:var(--ink);font-size:18px;font-weight:600;line-height:1.6;letter-spacing:-.045em;word-break:keep-all}
.rail-join p{margin:12px 0 22px;font-size:12px;line-height:1.9;letter-spacing:-.02em;color:var(--muted);word-break:keep-all}
.rail-join .primary-button{width:100%;min-height:39px}
.rail-join .join-note{text-align:center;font-size:10px;margin:12px 0 0;color:var(--soft)}
.rail-guide{padding:26px 5px 0}
.rail-guide h3{font-size:11px;font-weight:600;color:var(--ink);margin:0 0 13px;letter-spacing:-.01em}
.rail-guide ul{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.rail-guide li{display:flex;align-items:flex-start;gap:9px;font-size:11px;color:var(--muted);line-height:1.65;letter-spacing:-.02em}
.rail-guide .ui-icon{width:13px;height:13px;margin-top:3px;color:var(--green)}
.rail-about{margin-top:18px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;background:#047857;border:1px solid #047857;color:#fff;border-radius:8px;min-height:37px;padding:9px 14px;font-size:12px;font-weight:500;cursor:pointer;transition:background .15s,transform .15s;white-space:nowrap}
.primary-button:hover{background:#065f46;border-color:#065f46;transform:translateY(-1px)}
.primary-button .ui-icon{width:15px;height:15px}

.toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,8px);padding:12px 18px;max-width:calc(100% - 28px);background:var(--ink);color:var(--bg);border-radius:9px;font-size:11px;line-height:1.7;box-shadow:var(--shadow);opacity:0;pointer-events:none;z-index:100;transition:opacity .15s,transform .15s;width:max-content;text-align:center}
.toast.visible{opacity:1;transform:translate(-50%,0)}

/* 서비스 소개 모달 */
.ui-dialog{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);margin:0;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:16px;padding:30px;width:420px;max-width:calc(100vw - 28px);max-height:calc(100dvh - 80px);overflow:auto;box-shadow:var(--shadow)}
.ui-dialog::backdrop{background:rgba(24,24,27,.35);backdrop-filter:blur(4px)}
.dialog-close{position:absolute;right:10px;top:10px}
.dialog-eyebrow{font-size:9px;color:var(--green);letter-spacing:.13em;margin:10px 0 14px;font-weight:500;text-transform:uppercase}
.ui-dialog h2{font-size:24px;line-height:1.5;font-weight:500;letter-spacing:-.04em;margin:0 0 14px;word-break:keep-all;color:var(--ink)}
.ui-dialog>p{font-size:12px;line-height:1.9;color:var(--muted);word-break:keep-all;margin:0}
.about-steps{list-style:none;margin:24px 0 0;padding:0}
.about-steps li{padding:15px 0;border-top:1px solid var(--line)}
.about-steps strong{font-size:12px;font-weight:600;color:var(--ink)}
.about-steps p{font-size:12px;margin:5px 0 0;color:var(--muted);line-height:1.7}
.about-dialog .primary-button{width:100%;margin-top:22px}

/* 카드 — 원본 .pub-card (테두리 없는 플랫 행 + 호버 좌측 에메랄드 바) */
.grid{display:flex;flex-direction:column;gap:12px}
.pub-card{position:relative;border-radius:12px;padding:18px 20px;background:transparent;border:1px solid transparent;transition:background-color .18s,padding-left .22s cubic-bezier(.4,0,.2,1);padding-left:20px}
.pub-card::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 3px 3px 0;background:linear-gradient(#34d399,#059669);transform:scaleY(0);transform-origin:top;transition:transform .24s cubic-bezier(.4,0,.2,1)}
.pub-card:hover{background:rgba(0,0,0,.025);padding-left:24px}
.pub-card:hover::before{transform:scaleY(1)}
.c-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:6px}
.c-title{display:block;font-size:15px;font-weight:600;color:#27272a;text-decoration:none;line-height:1.35;margin-bottom:4px}
.c-title:hover{color:#059669}
.slug{display:inline-flex;align-items:center;gap:6px;border:1px solid #e4e4e7;background:#fafafa;border-radius:6px;padding:1px 8px;font-family:"JetBrains Mono",monospace;font-size:11px;color:#71717a;text-decoration:none}
.slug:hover{border-color:#a7f3d0;color:#059669}
.slug svg{width:12px;height:12px;flex:none}
.badge-pub{flex:none;border-radius:4px;background:#ecfdf5;color:#059669;font-family:"JetBrains Mono",monospace;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:3px 8px}
.summary{font-size:12.5px;line-height:1.6;color:#71717a;margin:8px 0}
.metrics{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;padding-bottom:10px;font-family:"JetBrains Mono",monospace;font-size:11.5px;color:#71717a}
.metrics svg{width:12px;height:12px;color:#a1a1aa}
.metrics b{font-weight:600;color:#27272a}
.metrics .m{display:inline-flex;align-items:center;gap:6px}
.tags{margin-left:auto;display:inline-flex;flex-wrap:wrap;gap:6px}
.tags span{border:1px solid #e4e4e7;background:#fafafa;border-radius:999px;padding:1px 8px;font-family:"JetBrains Mono",monospace;font-size:10px;color:#71717a}
.c-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;border-top:1px dashed #e4e4e7;padding-top:12px}
.acts{display:flex;align-items:center;gap:6px}
.pub-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:5px;border:1px solid #e4e4e7;background:transparent;color:#71717a;font:500 10.5px "JetBrains Mono",ui-monospace,Menlo,monospace;cursor:pointer;transition:color .12s,border-color .12s,background-color .12s;text-decoration:none}
.pub-btn:hover{border-color:#71717a;color:#18181b;background:#f4f4f5}
.pub-btn-primary:hover{border-color:#059669;color:#059669;background:rgba(16,185,129,.06)}
.pub-btn svg{width:12px;height:12px}
.when{display:flex;align-items:center;gap:12px;font-family:"JetBrains Mono",monospace;font-size:10.5px;color:#a1a1aa}
.when .au{border-right:1px solid #e4e4e7;padding-right:12px}
.when b{font-weight:500;color:#71717a}

@media(max-width:1100px){.page-shell.has-public-intro{max-width:1000px}.hero,.has-public-intro .public-explore-layout{grid-template-columns:minmax(0,1fr) 270px;gap:30px}.hero h2{font-size:33px}.hero-story{padding-left:20px}.rail-join{padding:22px 20px}}
@media(max-width:900px){.page-shell.has-public-intro{max-width:800px}.hero{grid-template-columns:minmax(0,1fr);padding:0 0 28px}.hero-story{display:none}.hero h2{font-size:34px}.hero-copy br{display:none}.has-public-intro .public-explore-layout{grid-template-columns:minmax(0,1fr);gap:30px;padding-top:24px}.visitor-rail{border-top:1px solid var(--line);padding-top:24px}}
@media(max-width:660px){.public-header{height:62px;padding:10px 16px}.public-context{display:none}.header-text{font-size:11px}.hero{padding:4px 0 25px}.hero h2{font-size:28px;line-height:1.5}.hero-copy{font-size:12px}.page-title{font-size:28px}.search-direction{flex-direction:column;align-items:flex-start;gap:10px}}
@media(prefers-reduced-motion:reduce){.ea-explore *,.ea-explore *::before,.ea-explore *::after{animation:none!important;transition:none!important}}
</style>

<!-- 다크 오버라이드는 non-scoped (플레인 클래스로 매칭). -->
<style>
html.dark .ea-explore{--bg:#18181b;--surface:#18181b;--ink:#e4e4e7;--muted:#a1a1aa;--soft:#71717a;--line:#27272a;--green:#34d399;--green-soft:#022c22;--green-line:#345847;--hover:#27272a;--glass:rgba(39,39,42,.4);--shadow:0 12px 36px rgba(0,0,0,.3)}
html.dark .ea-explore .public-header{border-bottom-color:rgba(255,255,255,.05)}
html.dark .ea-explore .sort-seg button[aria-pressed="true"]{background:#34343a;color:#e4e4e7}
html.dark .ea-explore .public-brand .serif-title{color:#10b981}
html.dark .ea-explore .action-primary{background:#10b981;border-color:#10b981;color:#082f25}
html.dark .ea-explore .hero,html.dark .ea-explore .visitor-rail{--green:#6ee7b7;--green-line:#345847;--green-soft:#21372e}
html.dark .ea-explore .primary-button{background:#10b981;border-color:#10b981;color:#102c23}
html.dark .ea-explore .primary-button:hover{background:#34d399;border-color:#34d399}
html.dark .ea-explore .c-title{color:#e4e4e7}
html.dark .ea-explore .c-title:hover{color:#34d399}
html.dark .ea-explore .slug{border-color:#27272a;background:rgba(39,39,42,.6);color:#a1a1aa}
html.dark .ea-explore .slug:hover{color:#34d399}
html.dark .ea-explore .badge-pub{background:rgba(16,185,129,.1);color:#34d399}
html.dark .ea-explore .summary{color:#a1a1aa}
html.dark .ea-explore .metrics{color:#a1a1aa}
html.dark .ea-explore .metrics svg{color:#52525b}
html.dark .ea-explore .metrics b{color:#e4e4e7}
html.dark .ea-explore .tags span{border-color:#27272a;background:rgba(39,39,42,.6)}
html.dark .ea-explore .c-foot{border-color:#27272a}
html.dark .ea-explore .pub-btn{border-color:#27272a;color:#a1a1aa}
html.dark .ea-explore .pub-btn:hover{border-color:#a1a1aa;color:#e4e4e7;background:#232327}
html.dark .ea-explore .pub-btn-primary:hover{border-color:#10b981;color:#34d399;background:rgba(16,185,129,.1)}
html.dark .ea-explore .when{color:#52525b}
html.dark .ea-explore .when .au{border-color:#3f3f46}
html.dark .ea-explore .when b{color:#a1a1aa}
html.dark .ea-explore .pub-card:hover{background:rgba(255,255,255,.025)}
html.dark .ea-explore .load-error{color:#fb7185}
</style>
