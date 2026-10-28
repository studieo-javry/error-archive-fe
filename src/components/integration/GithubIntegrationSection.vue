<script setup lang="ts">
/**
 * Settings → Integrations — GitHub App 연결(P0).
 * 마크업·문구·스타일은 error-archive-github-p0-mockup.html 그대로(스타일: styles/github-integration.css).
 * 목업에서 GitHub 화면을 흉내 낸 부분(App 설치 화면, 설치 관리 화면)은 만들지 않고 GitHub 로 이동한다.
 *
 * 흐름: 범위 선택 → GET install-url → GitHub 설치 화면(페이지 이동) → GitHub 가 Setup URL
 * (/settings/integrations/github/callback?installation_id&code&state)로 돌려보냄 → 로그인한 FE 가 POST installations.
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isAxiosError } from 'axios'
import GhIcon from './GhIcon.vue'
import { githubIntegrationApi } from '@/services/githubIntegrationApi'
import { useAuthStore } from '@/stores/authStore'
import { useTeamStore } from '@/stores/teamStore'
import { useAuth } from '@/composables/useAuth'
import type { GithubInstallation } from '@/types/githubIntegration'

const emit = defineEmits<{ (e: 'open-connections'): void }>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const teamStore = useTeamStore()
const { startSignup } = useAuth()

// 빌드 타임 플래그 — BE 기능이 꺼진 환경에선 "준비 중". 조회 404 로 추측하지 않는다.
const featureOff = import.meta.env.VITE_GITHUB_INTEGRATION_ENABLED !== 'true'

type Scope = 'all' | 'personal' | 'team'
type ErrorKind = 'expired' | 'forbidden' | 'conflict' | 'unavailable'
type DialogView = 'connect' | 'progress' | 'success' | 'error' | 'about' | null

const installs = ref<GithubInstallation[]>([])
const scope = ref<Scope>('all')
const query = ref<Record<number, string>>({})
const refreshing = ref(false)

// ── 권한 · 범위 ──
const isGuest = computed(() => authStore.isGuest)
const currentWorkspace = computed(() => teamStore.currentWorkspace)
const isAdmin = computed(() => currentWorkspace.value?.role === 'ADMIN')
const isMember = computed(() => !isGuest.value && !!currentWorkspace.value && !isAdmin.value)
const context = computed<'team' | 'personal'>(() => (currentWorkspace.value ? 'team' : 'personal'))
const teamLabel = computed(() => currentWorkspace.value?.name ?? 'Workspace')

function workspaceRole(workspaceId: number) {
  return teamStore.workspaces.find(w => w.workspaceId === workspaceId)?.role
}
function allowedManage(inst: GithubInstallation) {
  return !isGuest.value && (inst.workspaceId === null || workspaceRole(inst.workspaceId) === 'ADMIN')
}
function scopeLabel(inst: GithubInstallation) {
  if (inst.workspaceId === null) return 'Personal'
  return teamStore.workspaces.find(w => w.workspaceId === inst.workspaceId)?.name ?? 'Workspace'
}
function manageUrl(inst: GithubInstallation) {
  const login = encodeURIComponent(inst.accountLogin)
  return inst.accountType === 'Organization'
    ? `https://github.com/organizations/${login}/settings/installations/${inst.installationId}`
    : `https://github.com/settings/installations/${inst.installationId}`
}
function repoUrl(fullName: string) {
  return 'https://github.com/' + fullName.split('/').map(encodeURIComponent).join('/')
}
function repoParts(fullName: string) {
  const i = fullName.indexOf('/')
  return { owner: fullName.slice(0, i), name: fullName.slice(i + 1) }
}
function connectedDate(at: string) {
  return at.slice(0, 10).replace(/-/g, '.')
}

// ── 목록 ──
const filterTabs = computed(() => [
  { value: 'all' as const, label: '전체', count: installs.value.length },
  { value: 'personal' as const, label: 'Personal', count: installs.value.filter(x => x.workspaceId === null).length },
  { value: 'team' as const, label: teamLabel.value, count: installs.value.filter(x => x.workspaceId !== null).length },
])
const visibleInstalls = computed(() =>
  installs.value.filter(x => scope.value === 'all' || (scope.value === 'personal' ? x.workspaceId === null : x.workspaceId !== null)),
)
function visibleRepos(inst: GithubInstallation) {
  const q = (query.value[inst.installationId] || '').toLowerCase().trim()
  return inst.repositories.filter(r => r.fullName.toLowerCase().includes(q))
}

async function loadInstallations() {
  const { data } = await githubIntegrationApi.listInstallations()
  installs.value = data
}

async function refreshList(withToast: boolean) {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await loadInstallations()
    if (withToast) toast('연결 목록을 새로 불러왔어요.')
  } catch { /* 이전 목록 유지 */ } finally {
    refreshing.value = false
  }
}

// ── 토스트 ──
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function toast(message: string) {
  clearTimeout(toastTimer)
  toastMsg.value = message
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 3500)
}

// ── 대화상자 ──
const dialogEl = ref<HTMLDialogElement | null>(null)
const view = ref<DialogView>(null)
let operation = 0
let lastFocus: Element | null = null

async function showDialog(next: Exclude<DialogView, null>) {
  const d = dialogEl.value
  if (!d) return
  if (!d.open) lastFocus = document.activeElement
  view.value = next
  if (!d.open) d.showModal()
  d.scrollTop = 0
  await nextTick()
  const focus = d.querySelector<HTMLElement>('[autofocus]') || d.querySelector<HTMLElement>('h2')
  if (focus) {
    focus.setAttribute('tabindex', '-1')
    focus.focus({ preventScroll: true })
  }
}
function closeDialog() {
  operation++
  dialogEl.value?.close()
}
function onDialogClose() {
  view.value = null
  if (lastFocus instanceof HTMLElement && lastFocus.isConnected) lastFocus.focus({ preventScroll: true })
  // 콜백 화면에서 닫으면 Integrations 로 돌아간다.
  if (route.name === 'githubCallback') router.replace({ name: 'settingsIntegrations' })
}
function onDialogClick(event: MouseEvent) {
  const d = dialogEl.value
  if (!d || event.target !== d) return
  const rect = d.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog()
}

// ── ① 연결 범위 ──
const draftScope = ref<'personal' | 'team'>('personal')
const starting = ref(false)

function startConnect(keep = false) {
  if (isGuest.value || featureOff) return
  if (!keep) draftScope.value = !isAdmin.value ? 'personal' : scope.value === 'all' ? context.value : scope.value
  showDialog('connect')
}

/** "GitHub에서 계속" — 서명된 state 가 담긴 설치 URL 을 받아 GitHub 설치 화면으로 이동. */
async function continueToGithub() {
  if (starting.value) return
  starting.value = true
  try {
    const workspaceId = draftScope.value === 'team' ? (currentWorkspace.value?.workspaceId ?? null) : null
    const { data } = await githubIntegrationApi.getInstallUrl(workspaceId)
    window.location.assign(data.url)
  } catch (e) {
    starting.value = false
    callbackError(errorKind(e))
  }
}

// ── ③ 연결 확인 (Setup URL 로 돌아온 뒤) ──
const progressDone = ref(false)
const result = ref<{ inst: GithubInstallation; moved: boolean } | null>(null)
const errorView = ref<ErrorKind>('expired')

const errors: Record<ErrorKind, { title: string; message: string; action: string }> = {
  expired: { title: '연결 시간이 만료되었어요', message: '연결 요청이 만료되었거나 유효하지 않습니다.<br>연결을 시작한 Error Archive 계정으로 다시 시도해 주세요.', action: '연결 다시 시작' },
  forbidden: { title: '설치 권한을 확인해 주세요', message: '이 GitHub 계정으로 설치에 접근할 수 없거나<br>워크스페이스 관리자 권한이 변경되었습니다.<br>계정과 권한을 확인한 후 다시 연결해 주세요.', action: '연결 다시 시작' },
  conflict: { title: '다른 공간에 연결된 설치예요', message: '이 설치는 다른 사용자 또는 워크스페이스에 연결되어 있습니다.<br>기존 연결 관리자에게 확인하거나 다른 GitHub 계정을 선택해 주세요.', action: '연결 범위 다시 선택' },
  unavailable: { title: 'GitHub 응답을 기다리지 못했어요', message: '일시적으로 GitHub에 연결할 수 없습니다.<br>잠시 후 새로운 연결 요청으로 다시 시도해 주세요.', action: '연결 다시 시작' },
}

function errorKind(e: unknown): ErrorKind {
  const status = isAxiosError(e) ? e.response?.status : undefined
  if (status === 400) return 'expired'
  if (status === 403) return 'forbidden'
  if (status === 409) return 'conflict'
  return 'unavailable'
}

function callbackError(kind: ErrorKind) {
  errorView.value = kind
  showDialog('error')
}

// code 는 한 번만 쓸 수 있다 — 같은 code 로 두 번 POST 하지 않도록.
const handledCodes = new Set<string>()

async function handleCallback() {
  const q = route.query
  const installationId = Number(q.installation_id)
  const code = typeof q.code === 'string' ? q.code : ''
  const state = typeof q.state === 'string' ? q.state : ''
  const setupAction = typeof q.setup_action === 'string' ? q.setup_action : ''
  // 주소창에서 일회용 code 를 지운다(새로고침해도 다시 보내지 않게).
  await router.replace({ name: 'githubCallback' })

  // GitHub 설정에서 저장소만 바꾸고 돌아온 경우 — 우리가 시작한 연결이 아니므로 POST 하지 않는다.
  if (setupAction === 'update' && !state) {
    await router.replace({ name: 'settingsIntegrations' })
    await refreshList(false)
    toast('GitHub에서 변경한 저장소 목록을 확인했어요.')
    return
  }
  if (!installationId || !code || !state) return callbackError('expired')
  if (handledCodes.has(code)) return
  handledCodes.add(code)

  const id = ++operation
  progressDone.value = false
  showDialog('progress')
  try {
    const { data } = await githubIntegrationApi.completeInstallation({ installationId, code, state })
    if (id !== operation) return
    progressDone.value = true
    const existing = installs.value.find(x => x.installationId === data.installationId)
    const moved = !!existing && existing.workspaceId !== data.workspaceId
    installs.value = existing
      ? installs.value.map(x => (x.installationId === data.installationId ? data : x))
      : [...installs.value, data]
    scope.value = data.workspaceId === null ? 'personal' : 'team'
    query.value = {}
    result.value = { inst: data, moved }
    showDialog('success')
  } catch (e) {
    if (id !== operation) return
    callbackError(errorKind(e))
  }
}

function retry() {
  startConnect(false)
}

const steps = ['연결 범위', 'GitHub 설치', '연결 확인']

onMounted(async () => {
  if (isGuest.value || featureOff) return
  if (!teamStore.workspaces.length) await teamStore.fetchWorkspaces().catch(() => {})
  await refreshList(false)
  if (route.name === 'githubCallback') await handleCallback()
})
</script>

<template>
  <div class="gh-int">
    <div class="page-heading row between">
      <div>
        <h1>Integrations</h1>
        <p>개발 도구와 연결하고, 에러 기록의 맥락을 이어가세요.</p>
      </div>
      <div class="heading-end"><span class="pill">Workspace &amp; Personal</span></div>
    </div>

    <!-- 게스트 -->
    <div v-if="isGuest" class="empty">
      <div class="empty-graphic"><span class="graphic-icon"><GhIcon name="lock" /></span></div>
      <h3>로그인 후 GitHub를 연결할 수 있어요</h3>
      <p>게스트 세션에서는 연결 정보에 접근할 수 없습니다.<br>계정으로 로그인해 개인 또는 팀의 저장소를 연결하세요.</p>
      <button class="button primary" @click="startSignup">가입하기 <GhIcon name="arrow" class="sm" /></button>
    </div>

    <!-- 준비 중 -->
    <div v-else-if="featureOff" class="empty">
      <div class="empty-graphic"><span class="graphic-icon"><GhIcon name="github" /></span></div>
      <h3>GitHub 연동을 준비하고 있어요</h3>
      <p>아직 이 환경에서 GitHub 연동을 사용할 수 없습니다.<br>서비스가 준비되면 이곳에서 저장소를 연결할 수 있어요.</p>
      <span class="pill">준비 중</span>
    </div>

    <template v-else>
      <div class="integration-overview">
        <div class="row">
          <div class="service-icon"><GhIcon name="github" /></div>
          <div class="grow">
            <div class="row"><h2 class="service-name">GitHub</h2><span class="pill">App</span></div>
            <p class="service-desc">개인 계정이나 조직의 저장소를 Error Archive에 연결합니다.</p>
          </div>
          <button class="button primary" @click="startConnect()"><GhIcon name="plus" class="sm" />GitHub 연결</button>
        </div>
        <div class="overview-foot">
          <span class="row"><GhIcon name="shield" />선택한 저장소에만 읽기 권한을 요청합니다.</span>
          <button class="text-button" @click="showDialog('about')">연동 알아보기 <GhIcon name="chevron" /></button>
        </div>
      </div>

      <div v-if="isMember" class="notice">
        <GhIcon name="info" />
        <div>팀의 연결은 확인할 수 있어요. 워크스페이스 연결은 관리자만 설정할 수 있으며, 개인 연결은 직접 추가할 수 있습니다.</div>
      </div>

      <div class="section-heading">
        <h2>연결된 계정 <span>{{ installs.length }}</span></h2>
        <button class="text-button" :disabled="refreshing" @click="refreshList(true)"><GhIcon name="refresh" class="sm" />목록 새로고침</button>
      </div>

      <div class="filter-tabs" role="group" aria-label="연결 범위 필터">
        <button
          v-for="tab in filterTabs"
          :key="tab.value"
          class="filter-tab"
          :class="{ active: scope === tab.value }"
          :aria-pressed="scope === tab.value"
          @click="scope = tab.value"
        >{{ tab.label }}<span>{{ tab.count }}</span></button>
      </div>

      <div>
        <div v-if="refreshing" class="loading-list" role="status" aria-label="연결 목록을 불러오는 중">
          <div class="skeleton short" /><div class="skeleton" /><div class="skeleton" />
        </div>

        <div v-else-if="!visibleInstalls.length" class="empty">
          <div class="empty-graphic">
            <span class="graphic-icon"><GhIcon name="github" /></span><span class="connector" /><span class="graphic-icon ea">E</span>
          </div>
          <h3>{{ scope === 'all' ? '첫 번째 GitHub 계정을 연결해 보세요' : scope === 'team' ? '팀에 연결된 GitHub 계정이 없어요' : '개인 공간에 연결된 계정이 없어요' }}</h3>
          <p>GitHub에서 계정과 저장소를 선택하면<br>이곳에서 연결 상태와 저장소 목록을 확인할 수 있어요.</p>
          <span v-if="scope === 'team' && isMember" class="pill">워크스페이스 관리자에게 연결을 요청해 주세요</span>
          <button v-else class="button" @click="startConnect()"><GhIcon name="github" class="sm" />GitHub 연결하기</button>
        </div>

        <template v-else>
          <article v-for="inst in visibleInstalls" :key="inst.installationId" class="installation" :aria-label="`${inst.accountLogin} 연결`">
            <div class="installation-head">
              <div class="row">
                <div class="account-icon"><GhIcon :name="inst.accountType === 'Organization' ? 'building' : 'user'" /></div>
                <div class="grow">
                  <h3 class="account-name">{{ inst.accountLogin }}</h3>
                  <p class="account-type">GitHub {{ inst.accountType === 'Organization' ? 'Organization' : 'Personal account' }}</p>
                </div>
                <span class="pill" :class="inst.status === 'SUSPENDED' ? 'amber' : 'green'"><span class="dot" />{{ inst.status === 'SUSPENDED' ? '일시 중지' : '연결됨' }}</span>
              </div>
              <div class="install-meta">
                <span class="row"><GhIcon :name="inst.workspaceId === null ? 'user' : 'users'" />{{ scopeLabel(inst) }}</span>
                <span class="pill">{{ inst.workspaceId !== null ? 'Workspace' : 'Personal' }}</span>
                <span class="meta-divider" />
                <span class="date">{{ connectedDate(inst.connectedAt) }} 연결</span>
              </div>
            </div>

            <div v-if="inst.status === 'SUSPENDED'" class="notice amber">
              <GhIcon name="pause" />
              <div>GitHub에서 App 사용이 일시 중지되었습니다.<br>아래는 마지막으로 확인한 저장소예요. GitHub에서 다시 활성화해 주세요.</div>
            </div>

            <div class="repository-area">
              <div class="repository-head">
                <h3>연결된 저장소 <span>{{ inst.repositories.length }}</span></h3>
                <label class="search-wrap">
                  <GhIcon name="search" />
                  <span class="sr-only">{{ inst.accountLogin }} 저장소 검색</span>
                  <input v-model="query[inst.installationId]" placeholder="저장소 검색" autocomplete="off">
                </label>
              </div>
              <div>
                <div v-if="!visibleRepos(inst).length" class="repo-empty">
                  <GhIcon :name="query[inst.installationId]?.trim() ? 'search' : 'repo'" />
                  {{ query[inst.installationId]?.trim() ? '검색 결과가 없어요' : '연결된 저장소가 없어요' }}
                  <p>{{ query[inst.installationId]?.trim() ? '다른 저장소 이름으로 검색해 보세요.' : 'GitHub에서 App이 접근할 저장소를 선택해 주세요.' }}</p>
                  <button v-if="query[inst.installationId]?.trim()" class="text-button" style="margin-top:10px" @click="query[inst.installationId] = ''">검색 초기화</button>
                </div>
                <div v-for="r in visibleRepos(inst)" v-else :key="r.repoId" class="repo-row">
                  <GhIcon name="repo" />
                  <div class="repo-info">
                    <a class="repo-name" :href="repoUrl(r.fullName)" target="_blank" rel="noopener noreferrer"><span class="repo-owner">{{ repoParts(r.fullName).owner }} / </span>{{ repoParts(r.fullName).name }}</a>
                    <span class="pill"><GhIcon v-if="r.isPrivate" name="lock" class="sm" />{{ r.isPrivate ? 'Private' : 'Public' }}</span>
                  </div>
                  <a class="icon-button" :href="repoUrl(r.fullName)" target="_blank" rel="noopener noreferrer" :aria-label="`${repoParts(r.fullName).name} GitHub에서 열기`" title="GitHub에서 열기"><GhIcon name="external" class="sm" /></a>
                </div>
              </div>
            </div>

            <div class="repository-footer">
              <span class="row"><GhIcon name="lock" />저장소 접근 권한은 GitHub에서 관리됩니다.</span>
              <a v-if="allowedManage(inst)" class="text-button" :href="manageUrl(inst)" target="_blank" rel="noopener noreferrer">GitHub에서 관리 <GhIcon name="external" /></a>
              <span v-else class="muted">워크스페이스 관리자만 설정 가능</span>
            </div>
          </article>
        </template>
      </div>

      <div class="note">
        <GhIcon name="info" />
        <span>GitHub 로그인 계정과 저장소 연동은 별도로 관리됩니다.<br>로그인에 사용하는 계정은 <button class="text-button" style="font-size:inherit" @click="emit('open-connections')">Connections</button>에서 확인할 수 있어요.</span>
      </div>

      <div class="future-note">
        <span class="pill">준비 중</span>
        <p>Issue·PR·CI를 Case의 근거로 연결하는 기능이 이어질 예정입니다.<br>현재는 GitHub 연결과 접근 가능한 저장소 목록을 확인할 수 있어요.</p>
      </div>
    </template>

    <!-- 대화상자 -->
    <dialog ref="dialogEl" aria-labelledby="gh-dialog-title" @close="onDialogClose" @cancel="operation++" @click="onDialogClick">
      <!-- ① 연결 범위 -->
      <template v-if="view === 'connect'">
        <div class="modal-top">
          <div class="row"><GhIcon name="github" /><strong>GitHub 연결</strong></div>
          <button class="icon-button" aria-label="닫기" @click="closeDialog"><GhIcon name="close" /></button>
        </div>
        <div class="modal-inner">
          <div class="steps">
            <template v-for="(s, i) in steps" :key="s"><GhIcon v-if="i" name="chevron" /><span :class="{ current: i === 0 }"><span class="step-num">{{ i + 1 }}</span>{{ s }}</span></template>
          </div>
          <h2 id="gh-dialog-title">어디에 연결할까요?</h2>
          <p class="modal-intro">연결된 계정과 저장소를 확인할 공간을 선택하세요.</p>
          <div style="margin-top:22px">
            <label class="scope-option">
              <GhIcon name="user" />
              <div class="grow"><strong>Personal</strong><p>나만 사용하는 개인 공간에 연결합니다.</p></div>
              <input v-model="draftScope" type="radio" name="gh-scope" value="personal">
            </label>
            <label v-if="currentWorkspace" class="scope-option">
              <GhIcon name="users" />
              <div class="grow">
                <strong>{{ currentWorkspace.name }} <span class="pill">{{ isAdmin ? 'Admin' : 'Member' }}</span></strong>
                <p>{{ isAdmin ? '워크스페이스 멤버와 연결 목록을 함께 확인합니다.' : '워크스페이스 관리자만 연결할 수 있습니다.' }}</p>
              </div>
              <input v-model="draftScope" type="radio" name="gh-scope" value="team" :disabled="!isAdmin">
            </label>
          </div>
          <p class="scope-hint"><GhIcon name="info" class="sm" /> 다음 단계에서 GitHub 계정과 저장소를 선택합니다.<br>GitHub의 설치 권한도 함께 필요합니다.</p>
        </div>
        <div class="modal-actions">
          <button class="button ghost" @click="closeDialog">취소</button>
          <button class="button primary" :disabled="starting" @click="continueToGithub">GitHub에서 계속 <GhIcon name="external" class="sm" /></button>
        </div>
      </template>

      <!-- ③ 연결 확인 중 -->
      <template v-else-if="view === 'progress'">
        <div class="modal-top">
          <div class="row"><GhIcon name="github" /><strong>연결 확인</strong></div>
          <button class="icon-button" aria-label="닫기" @click="closeDialog"><GhIcon name="close" /></button>
        </div>
        <div class="status-view">
          <div class="steps">
            <template v-for="(s, i) in steps" :key="s"><GhIcon v-if="i" name="chevron" /><span :class="{ current: i === 2 }"><span class="step-num">{{ i < 2 ? '✓' : i + 1 }}</span>{{ s }}</span></template>
          </div>
          <div class="status-symbol"><span class="spinner" /></div>
          <h2 id="gh-dialog-title">GitHub 연결을 확인하고 있어요</h2>
          <p>설치 권한을 확인하고 선택한 저장소를 가져옵니다.<br>잠시만 기다려 주세요.</p>
          <div class="checklist">
            <span class="row"><GhIcon name="check" />Error Archive 로그인 확인</span>
            <span v-if="progressDone" class="row muted"><GhIcon name="check" />GitHub 설치 정보 확인</span>
            <span v-else class="row muted"><GhIcon name="refresh" />GitHub 설치 권한 확인 중</span>
            <span class="row muted"><GhIcon name="repo" />저장소 목록 불러오기</span>
          </div>
        </div>
      </template>

      <!-- ③ 연결 완료 -->
      <template v-else-if="view === 'success' && result">
        <div class="modal-top">
          <div class="row"><GhIcon name="github" /><strong>GitHub 연결 완료</strong></div>
          <button class="icon-button" aria-label="닫기" @click="closeDialog"><GhIcon name="close" /></button>
        </div>
        <div class="status-view">
          <div class="status-symbol"><GhIcon name="check" /></div>
          <h2 id="gh-dialog-title">GitHub가 연결되었어요</h2>
          <p>{{ result.inst.accountLogin }}의 저장소를<br>{{ scopeLabel(result.inst) }}에서 확인할 수 있어요.</p>
          <dl class="success-detail">
            <dt>GitHub 계정</dt><dd>{{ result.inst.accountLogin }}</dd>
            <dt>연결 범위</dt><dd>{{ scopeLabel(result.inst) }}{{ result.inst.workspaceId ? ' · Workspace' : '' }}</dd>
            <dt>연결된 저장소</dt><dd>{{ result.inst.repositories.length }}개</dd>
          </dl>
          <div v-if="result.moved" class="notice amber" style="margin-top:16px;text-align:left">기존 설치를 새로 선택한 공간으로 연결했습니다. 이전 공간의 연결 목록에서는 제거됩니다.</div>
        </div>
        <div class="modal-actions">
          <span class="small muted">설정은 GitHub에서 변경할 수 있어요.</span>
          <button class="button primary" @click="closeDialog">저장소 확인 <GhIcon name="arrow" class="sm" /></button>
        </div>
      </template>

      <!-- ③ 연결 실패 -->
      <template v-else-if="view === 'error'">
        <div class="modal-top">
          <div class="row"><GhIcon name="github" /><strong>GitHub 연결 확인</strong></div>
          <button class="icon-button" aria-label="닫기" @click="closeDialog"><GhIcon name="close" /></button>
        </div>
        <div class="status-view">
          <div class="status-symbol" :class="errorView === 'unavailable' ? 'warn' : 'error'"><GhIcon :name="errorView === 'unavailable' ? 'refresh' : 'alert'" /></div>
          <h2 id="gh-dialog-title">{{ errors[errorView].title }}</h2>
          <p v-html="errors[errorView].message" />
          <div class="notice" style="margin-top:23px;text-align:left"><GhIcon name="info" /><span>연결은 완료되지 않았습니다. 기존 연결 정보는 그대로 유지됩니다.</span></div>
        </div>
        <div class="modal-actions">
          <button class="button ghost" @click="closeDialog">설정으로 돌아가기</button>
          <button class="button primary" @click="retry">{{ errors[errorView].action }}</button>
        </div>
      </template>

      <!-- 연동 알아보기 -->
      <template v-else-if="view === 'about'">
        <div class="modal-top">
          <div class="row"><GhIcon name="github" /><strong>GitHub 연동 안내</strong></div>
          <button class="icon-button" aria-label="닫기" @click="closeDialog"><GhIcon name="close" /></button>
        </div>
        <div class="modal-inner">
          <div class="eyebrow">Your workflow, connected</div>
          <h2 id="gh-dialog-title">저장소와 에러 기록 사이의 연결</h2>
          <p class="modal-intro">GitHub App을 설치하고, Error Archive에서 사용할 저장소를 선택하세요.</p>
          <div class="checklist" style="max-width:none;margin:22px 0">
            <span class="row"><GhIcon name="check" />개인 또는 워크스페이스별 연결</span>
            <span class="row"><GhIcon name="check" />공개·비공개 저장소 목록 확인</span>
            <span class="row"><GhIcon name="check" />GitHub의 저장소 변경 사항 반영</span>
          </div>
          <p class="scope-hint">GitHub App 설치와 로그인용 계정 연결은 별개입니다. 워크스페이스 연결은 Error Archive 관리자 권한과 GitHub 설치 권한이 필요합니다.</p>
          <div class="notice" style="margin:20px 0 0"><GhIcon name="info" />현재는 연결과 저장소 목록 확인을 제공합니다. Issue를 Case에 연결하거나 PR·CI 근거를 모으는 기능은 다음 단계에서 제공됩니다.</div>
        </div>
        <div class="modal-actions">
          <span class="tiny muted">접근할 저장소는 언제든 GitHub에서 변경 가능</span>
          <button class="button primary" @click="closeDialog">확인</button>
        </div>
      </template>
    </dialog>

    <div v-if="toastMsg" class="toast" role="status" aria-live="polite"><GhIcon name="check" /><span>{{ toastMsg }}</span></div>
  </div>
</template>
