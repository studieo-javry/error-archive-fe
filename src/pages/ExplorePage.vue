<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { publishmentApi } from '@/services/publishmentApi'
import type { PublicPublishmentItem } from '@/types/publish'
import { formatAbsolute } from '@/utils/timeAgo'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/composables/useTheme'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

// Explore = 공개(PUBLIC+LIVE) 발행물 쇼케이스(전역). 로그아웃도 접근(랜딩/SEO/데모) → 자체 헤더/히어로/레일,
// 로그인 상태면 앱 사이드바 안에서 피드만 렌더(헤더/히어로/레일 숨김). 데이터는 GET /publishments/public(무인증).
const router = useRouter()
const authStore = useAuthStore()
const { toggle: toggleTheme } = useTheme()
const isAuthed = computed(() => authStore.isAuthenticated && !authStore.isGuest)

const items = ref<PublicPublishmentItem[]>([])
const loading = ref(false)
const loadError = ref('')
const query = ref('')
const activeTag = ref('all')
const sort = ref<'recent' | 'views' | 'steps'>('recent')
const toastMsg = ref('')
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

// 태그 필터 = 큐레이션 고정 카테고리. 데이터에 따라 칩이 변하지 않아(결정적) 쇼케이스가 다루는 영역을
// 또렷이 노출한다. 칩은 해당 태그를 가진 발행물만 필터(없으면 empty-state → "전체 보기").
const FILTER_TAGS = ['spring', 'database', 'kafka', 'kubernetes', 'redis']

// 클라이언트 검색(제목/요약/태그/slug) + 태그 필터 + 정렬. (쇼케이스 규모라 로드된 목록 위에서 처리)
const visibleItems = computed(() => {
  const words = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = items.value.filter((p) => {
    const tagOk = activeTag.value === 'all' || p.tags.map((t) => t.toLowerCase()).includes(activeTag.value)
    if (!tagOk) return false
    if (!words.length) return true
    const hay = `${p.title} ${p.summary ?? ''} ${p.descriptionPreview ?? ''} ${p.tags.join(' ')} ${p.slug}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
  const s = sort.value
  return [...filtered].sort((a, b) =>
    s === 'views' ? b.viewCount - a.viewCount
      : s === 'steps' ? b.stepCount - a.stepCount
        : b.publishedAt.localeCompare(a.publishedAt),
  )
})
const hasFilter = computed(() => !!query.value.trim() || activeTag.value !== 'all')

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
function resetFilters() { query.value = ''; activeTag.value = 'all' }

// '/' 로 검색 포커스
function onKeydown(e: KeyboardEvent) {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
  const el = document.activeElement
  if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return
  const input = document.getElementById('ea-search') as HTMLInputElement | null
  if (input) { e.preventDefault(); input.focus() }
}
// ③ 탭 복귀 시 조용히 최신 views 반영(10초 쓰로틀). 카드가 새 탭으로 열려 재마운트가 안 되는 문제 보완.
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
    <!-- 로그아웃: 자체 헤더 -->
    <header v-if="!isAuthed" class="site-header">
      <nav class="site-nav shell" aria-label="메인 메뉴">
        <a class="site-brand" href="/" aria-label="ErrorArchive 홈">
          <span class="site-brand-mark" aria-hidden="true"><svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/></svg></span>
          <span class="site-brand-name">ErrorArchive</span>
        </a>
        <div class="site-nav-links">
          <a class="site-nav-link" href="#explore" aria-current="page"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c4 4 4 14 0 18M12 3c-4 4-4 14 0 18"/></svg>둘러보기</a>
          <a class="site-nav-link" href="/">서비스 소개</a>
        </div>
        <div class="site-actions">
          <button class="icon-button" type="button" aria-label="테마 전환" @click="toggleTheme">
            <svg class="ui-icon theme-dark" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 14.1A8.8 8.8 0 0 1 9.9 3.6 8.8 8.8 0 1 0 20.4 14.1Z"/></svg>
            <svg class="ui-icon theme-light" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/></svg>
          </button>
          <button class="login-button" type="button" @click="goLogin">로그인</button>
          <button class="primary-button" type="button" @click="goLogin"><span><span class="cta-long">기록 </span>시작하기</span><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button>
        </div>
      </nav>
    </header>

    <main class="shell" :class="{ 'shell-authed': isAuthed }">
      <!-- 로그아웃: 히어로 -->
      <section v-if="!isAuthed" class="hero" aria-labelledby="hero-title">
        <div>
          <p class="hero-eyebrow mono">A HOME FOR SOLVED ERRORS</p>
          <h1 id="hero-title">누군가의 시행착오가,<br>당신의 <em>해결책</em>이 되도록.</h1>
          <p class="hero-copy">증상부터 시도, 그리고 해결까지. <br>개발자들이 남긴 문제 해결의 과정을 함께 탐색하세요.</p>
        </div>
        <div class="hero-story" aria-label="ErrorArchive 의 기록 과정">
          <p class="story-caption mono">EVERY FIX HAS A STORY</p>
          <div class="story-item"><span class="story-icon"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6M8 13h8m-8 4h5"/></svg></span><div><strong>에러를 마주하고</strong><small>문제가 시작된 맥락과 증상</small></div></div>
          <div class="story-item"><span class="story-icon"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v12a4 4 0 0 0 4 4h3M5 9h8a4 4 0 0 1 4 4v3"/><circle cx="5" cy="4" r="2"/><circle cx="17" cy="18" r="2"/></svg></span><div><strong>해결의 실마리를 찾고</strong><small>시도한 방법과 확인한 근거</small></div></div>
          <div class="story-item"><span class="story-icon"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></span><div><strong>다음 사람에게 전해요</strong><small>검증한 해결책과 배운 것</small></div></div>
        </div>
      </section>

      <div class="explore-layout" :class="{ single: isAuthed }">
        <section class="feed" id="explore" aria-labelledby="feed-title">
          <form role="search" @submit.prevent>
            <div class="search-box">
              <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
              <input id="ea-search" v-model="query" type="search" aria-label="에러, 기술 스택, 키워드 검색" placeholder="어떤 에러를 만났나요? 에러·기술 스택·키워드 검색" autocomplete="off">
              <kbd v-if="!query" class="search-shortcut" aria-hidden="true">/</kbd>
              <button v-else class="icon-button search-clear" type="button" aria-label="검색어 지우기" @click="query = ''"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button>
            </div>
          </form>

          <div class="filter-row" role="group" aria-label="태그 필터">
            <button class="filter-chip" type="button" :aria-pressed="activeTag === 'all'" @click="activeTag = 'all'">전체</button>
            <button v-for="t in FILTER_TAGS" :key="t" class="filter-chip" type="button" :aria-pressed="activeTag === t" @click="activeTag = t"><span>#</span>{{ t }}</button>
          </div>

          <div class="feed-heading">
            <div class="feed-title">
              <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c4 4 4 14 0 18M12 3c-4 4-4 14 0 18"/></svg>
              <h2 id="feed-title">공개된 해결 기록</h2>
              <span class="feed-count mono" aria-live="polite">{{ visibleItems.length }}</span>
            </div>
            <label class="feed-sort" aria-label="정렬 기준">
              <svg class="ui-icon sort-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h11M4 17h6"/></svg>
              <select v-model="sort">
                <option value="recent">최신순</option>
                <option value="views">조회순</option>
                <option value="steps">시도 많은 순</option>
              </select>
              <svg class="ui-icon sort-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
            </label>
          </div>

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
              <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
              <h3>{{ items.length ? '아직 일치하는 기록이 없어요.' : 'Nothing to Explore Yet' }}</h3>
              <p v-if="items.length">다른 키워드로 검색하거나 태그를 바꿔 보세요.</p>
              <p v-else>Public write-ups appear here as people publish the cases they've solved.</p>
              <button v-if="items.length" class="text-button" type="button" @click="resetFilters">전체 기록 보기 <svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button>
            </div>
            <p v-else class="feed-end">{{ hasFilter ? '조건에 맞는 기록을 모두 살펴봤어요.' : '공개된 기록을 모두 살펴봤어요.' }}</p>
          </template>
        </section>

        <!-- 로그아웃: 우측 레일(가입 유도 + 가이드) -->
        <aside v-if="!isAuthed" class="rail" aria-label="처음 방문하셨나요?">
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
          </section>
        </aside>
      </div>
    </main>

    <footer v-if="!isAuthed" class="site-footer">
      <div class="shell footer-inner">
        <div><span class="footer-brand">ErrorArchive</span><p class="footer-tagline">Today's error becomes tomorrow's weapon.</p></div>
        <span class="footer-right">Built for the next breakthrough.</span>
      </div>
    </footer>

    <div class="toast" :class="{ visible: toastMsg }" role="status" aria-live="polite">{{ toastMsg }}</div>
  </div>
</template>

<style scoped>
.ea-explore{
  --bg:#f7f7f5;--surface:#fff;--ink:#27272a;--muted:#71717a;--soft:#a1a1aa;--line:#e4e4e7;
  --green:#047857;--green-hover:#065f46;--green-soft:#eaf5ee;--green-line:#cce5d5;--tint:#f0f2ed;
  --shadow:0 16px 64px rgba(24,24,27,.14);
}
.ea-explore :focus-visible{outline:2px solid var(--green);outline-offset:4px}
.shell{width:calc(100% - 64px);max-width:1080px;margin:0 auto}
.shell-authed{width:100%;max-width:none}
.ui-icon{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}
.mono{font-family:"JetBrains Mono",ui-monospace,monospace}

.site-header{border-bottom:1px solid var(--line);background:var(--bg)}
.site-nav{display:flex;align-items:center;height:76px;gap:36px}
.site-brand{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;flex:none}
.site-brand-mark{display:grid;place-items:center;width:33px;height:33px;background:var(--green-soft);border:1px solid var(--green-line);border-radius:9px;color:var(--green)}
.site-brand-mark svg{width:19px;height:19px}
.site-brand-name{font-size:18px;letter-spacing:-.035em;font-weight:700}
.site-nav-links{display:flex;align-items:stretch;align-self:stretch;gap:25px}
.site-nav-link{position:relative;display:flex;align-items:center;gap:6px;border:0;background:none;color:var(--muted);font-size:12px;text-decoration:none;white-space:nowrap;font-weight:500;cursor:pointer}
.site-nav-link:hover{color:var(--ink)}
.site-nav-link[aria-current]{color:var(--green)}
.site-nav-link[aria-current]::after{content:"";height:2px;position:absolute;bottom:-1px;left:0;right:0;background:var(--green)}
.site-nav-link .ui-icon{width:15px;height:15px}
.site-actions{display:flex;align-items:center;gap:18px;margin-left:auto}
.icon-button{border:0;background:none;width:34px;height:34px;border-radius:8px;display:grid;place-items:center;color:var(--muted);cursor:pointer}
.icon-button:hover{background:var(--tint);color:var(--ink)}
.theme-light{display:none}
.login-button{padding:0;border:0;background:none;color:var(--muted);font-size:12px;font-weight:500;white-space:nowrap;cursor:pointer}
.login-button:hover{color:var(--ink)}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;background:#047857;border:1px solid #047857;color:#fff;border-radius:8px;min-height:37px;padding:9px 14px;font-size:12px;font-weight:500;text-decoration:none;transition:background .15s,transform .15s;white-space:nowrap;cursor:pointer}
.primary-button:hover{background:#065f46;border-color:#065f46;transform:translateY(-1px)}
.primary-button .ui-icon{width:15px;height:15px}

.hero{display:grid;grid-template-columns:minmax(0,720px) minmax(0,320px);gap:40px;padding:42px 0 34px;border-bottom:1px solid var(--line);align-items:center}
.hero-eyebrow{display:flex;align-items:center;gap:9px;margin:0 0 15px;color:var(--green);font-size:10px;font-weight:500;letter-spacing:.12em}
.hero-eyebrow::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--green)}
.hero h1{font-size:36px;line-height:1.4;letter-spacing:-.045em;font-weight:600;margin:0;color:var(--ink);word-break:keep-all}
.hero h1 em{font-style:normal;color:var(--green)}
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

.explore-layout{display:grid;grid-template-columns:minmax(0,720px) minmax(0,320px);gap:40px;padding:28px 0 48px;align-items:start}
.explore-layout.single{grid-template-columns:minmax(0,1fr);padding-top:4px}
.feed{min-width:0}
.search-box{display:flex;align-items:center;gap:11px;padding:0 15px;background:var(--surface);height:48px;border:1px solid var(--line);border-radius:9px;transition:border-color .15s,box-shadow .15s}
.search-box:focus-within{border-color:var(--green);box-shadow:0 0 0 3px var(--green-soft)}
.search-box>.ui-icon{color:var(--soft)}
.search-box input{outline:none;border:0;background:none;color:var(--ink);font-size:12px;width:100%;min-width:0;height:100%;padding:0;letter-spacing:-.015em}
.search-box input::placeholder{color:var(--soft)}
.search-box input::-webkit-search-cancel-button{display:none}
.search-shortcut{display:flex;align-items:center;gap:3px;flex:none;color:var(--soft);font-family:"JetBrains Mono",ui-monospace,monospace;font-size:10px;border:1px solid var(--line);border-radius:4px;padding:3px 5px}
.search-clear{width:25px;height:25px}
.search-clear .ui-icon{width:14px;height:14px}
.filter-row{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:13px 0 23px}
.filter-chip{background:transparent;border:1px solid transparent;border-radius:6px;color:var(--muted);font-size:10px;padding:6px 9px;line-height:1.2;transition:background .15s,color .15s;cursor:pointer}
.filter-chip:hover{background:var(--tint);color:var(--ink)}
.filter-chip[aria-pressed="true"]{color:var(--green);background:var(--green-soft);border-color:var(--green-line)}
.filter-chip:not(:first-child){font-family:"JetBrains Mono",ui-monospace,monospace}
.filter-chip span{color:var(--soft);margin-right:2px}
.feed-heading{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding:0 0 14px;margin-bottom:9px;gap:12px}
.feed-title{display:flex;align-items:center;gap:8px}
.feed-title .ui-icon{width:17px;height:17px;color:var(--green)}
.feed-title h2{font-size:15px;letter-spacing:-.03em;font-weight:600;margin:0;color:var(--ink)}
.feed-count{font-size:10px;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:1px 5px;line-height:1.5}
.feed-sort{position:relative;display:flex;align-items:center;gap:6px;color:var(--muted)}
.feed-sort .sort-icon{position:absolute;left:0;pointer-events:none;width:13px;height:13px}
.feed-sort .sort-chevron{position:absolute;right:0;pointer-events:none;width:12px;height:12px}
.feed-sort select{font-size:10px;border:0;appearance:none;background:transparent;color:var(--muted);padding:4px 17px 4px 20px;cursor:pointer}
.feed-sort option{background:var(--surface);color:var(--ink)}
.load-error{font-size:13px;color:#e11d48;padding:24px 4px}
.empty-state{padding:55px 20px;text-align:center;color:var(--muted)}
.empty-state>.ui-icon{width:24px;height:24px;color:var(--soft);margin-bottom:5px}
.empty-state h3{font-size:14px;font-weight:500;color:var(--ink)}
.empty-state p{font-size:12px;line-height:1.8}
.text-button{border:0;background:none;padding:0;color:var(--green);font-size:12px;display:inline-flex;align-items:center;gap:6px;font-weight:500;cursor:pointer}
.text-button:hover{text-decoration:underline;text-underline-offset:4px}
.text-button .ui-icon{width:14px;height:14px}
.feed-end{margin:22px 20px 0;border-top:1px solid var(--line);padding-top:19px;text-align:center;font-size:10px;color:var(--soft)}

.rail{min-width:0}
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

.site-footer{border-top:1px solid var(--line);padding:22px 0 28px}
.footer-inner{display:flex;justify-content:space-between;align-items:center;gap:16px}
.footer-brand{font-weight:600;font-size:11px;color:var(--muted);letter-spacing:-.025em}
.footer-tagline{color:var(--soft);font-size:10px;margin:7px 0 0}
.footer-right{font-size:10px;color:var(--soft)}
.toast{position:fixed;left:50%;bottom:24px;z-index:60;transform:translate(-50%,12px);opacity:0;pointer-events:none;background:var(--ink);color:var(--bg);border:1px solid var(--line);border-radius:9px;padding:12px 18px;font-size:12px;line-height:1.6;text-align:center;max-width:calc(100% - 32px);width:max-content;box-shadow:var(--shadow);transition:opacity .18s,transform .18s}
.toast.visible{opacity:1;transform:translate(-50%,0)}

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

@media(max-width:1100px){.shell{max-width:1000px}.site-nav{gap:28px}.site-nav-links{gap:20px}.hero,.explore-layout{grid-template-columns:minmax(0,1fr) 270px;gap:30px}.hero h1{font-size:33px}.hero-story{padding-left:20px}.rail-join{padding:22px 20px}}
@media(max-width:900px){.shell{width:calc(100% - 48px);max-width:720px}.hero{grid-template-columns:minmax(0,1fr);padding:33px 0 28px}.hero-story{display:none}.hero-copy br{display:none}.explore-layout{grid-template-columns:minmax(0,1fr);gap:26px;padding-top:24px}.rail{display:none}}
@media(max-width:660px){.shell{width:calc(100% - 32px)}.site-nav{height:auto;flex-wrap:wrap;gap:0;padding-top:15px}.site-actions{gap:10px}.site-actions .login-button{display:none}.site-actions .primary-button{padding:8px 10px;font-size:11px;min-height:34px}.cta-long{display:none}.site-nav-links{order:3;width:100%;margin-top:9px;height:42px;gap:25px}.hero{padding:28px 0 25px}.hero h1{font-size:28px;line-height:1.5}.hero-copy{font-size:12px}.search-shortcut{display:none}}
@media(prefers-reduced-motion:reduce){.ea-explore *,.ea-explore *::before,.ea-explore *::after{animation:none!important;transition:none!important}}
</style>

<!-- 다크 오버라이드는 non-scoped (LightningCSS 가 scoped :global(.dark) 를 드랍 → 플레인 클래스로 매칭). -->
<style>
html.dark .ea-explore{
  --bg:#18181b;--surface:#202023;--ink:#e4e4e7;--muted:#a1a1aa;--soft:#81818b;--line:#323237;
  --green:#6ee7b7;--green-hover:#a7f3d0;--green-soft:#21372e;--green-line:#345847;--tint:#232725;
  --shadow:0 16px 64px rgba(0,0,0,.4);
}
html.dark .ea-explore .theme-light{display:block}
html.dark .ea-explore .theme-dark{display:none}
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
