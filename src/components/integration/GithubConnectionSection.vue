<script setup lang="ts">
/**
 * Settings → Integrations — GitHub 멀티-공간 연결(2차).
 *
 * 마크업·문구·클래스·아이콘은 error_archive_github_multiscope_conditional_layout.html(GH2) 그대로,
 * 스타일은 styles/github-integration.css 의 .gh-int/.gh2 규칙을 쓴다. 데이터·동작은 실제
 * /integrations/github 엔드포인트에 배선한다(P0 GithubIntegrationSection 의 콜백·리다이렉트·에러 패턴 재사용).
 *
 * 흐름
 *  - 목록      : GET  /connections
 *  - 연결 옵션 : GET  /connection-options (discoveryStatus — ②: 저장 토큰 재사용 시 GitHub 재이동 없음)
 *  - 인가 이동 : NOT_AUTHORIZED → authorizeUrl, VERIFIED_EMPTY → installUrl 로 GitHub 이동
 *  - 후보      : POST /connection-candidates (OAuth 콜백 code·state)
 *  - 설치 완료 : POST /installations (Flow B — installation_id·code·state 콜백)
 *  - 연결/변경 : POST /connections · PUT /connections/{id}/repositories
 *  - 해제      : DELETE /connections/{id}
 *  - 재동기화  : POST /installations/{id}/refresh-repositories (Configure 에서 범위 바꾸고 돌아온 경우)
 * 목업이 시뮬레이션으로 그린 GitHub 화면(설치·Configure)은 실제로는 GitHub 로 이동한다.
 */
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isAxiosError } from 'axios'
import GhIcon from './GhIcon.vue'
import { githubConnectionApi } from '@/services/githubConnectionApi'
import { useAuthStore } from '@/stores/authStore'
import { useTeamStore } from '@/stores/teamStore'
import { useAuth } from '@/composables/useAuth'
import type {
  GithubCandidateRepository,
  GithubConnection,
  GithubConnectionCandidate,
} from '@/types/githubConnection'

const emit = defineEmits<{ (e: 'open-connections'): void }>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const teamStore = useTeamStore()
const { startSignup } = useAuth()

// 빌드 타임 플래그 — BE 기능이 꺼진 환경에선 "준비 중".
const featureOff = import.meta.env.VITE_GITHUB_INTEGRATION_ENABLED !== 'true'

const isGuest = computed(() => authStore.isGuest)
const workspaces = computed(() => teamStore.workspaces)
const isAdminOfAny = computed(() => workspaces.value.some(w => w.role === 'ADMIN'))

// ───────────────────────── 목록 상태 ─────────────────────────
const connections = ref<GithubConnection[]>([])
const loaded = ref(false)
const listError = ref(false)
const busy = ref(false)

// 'all' | 'personal' | 'team' | `ws:${workspaceId}`
const filter = ref<string>('all')
const compactSearch = ref('')
const compactPage = ref(0)
const expandedId = ref<number | null>(null)
const cardSearch = reactive<Record<number, string>>({})

const PAGE_SIZE = 6

function spaceKey(conn: GithubConnection): string {
  return conn.workspaceId === null ? 'personal' : `ws:${conn.workspaceId}`
}
function wsScopeId(scope: string): number | null {
  return scope.startsWith('ws:') ? Number(scope.slice(3)) : null
}
function scopeLabel(scope: string): string {
  if (scope === 'personal') return 'Personal'
  const id = wsScopeId(scope)
  return workspaces.value.find(w => w.workspaceId === id)?.name ?? '워크스페이스'
}
function isAdminOf(workspaceId: number): boolean {
  return workspaces.value.some(w => w.workspaceId === workspaceId && w.role === 'ADMIN')
}
function canScope(scope: string): boolean {
  if (isGuest.value) return false
  if (scope === 'personal') return true
  const id = wsScopeId(scope)
  return id !== null && isAdminOf(id)
}
function usableRepos(conn: GithubConnection) {
  const grant = new Set(conn.availableRepositories.map(r => r.repoId))
  return conn.selectedRepositories.filter(r => grant.has(r.repoId))
}
function revokedCount(conn: GithubConnection): number {
  return conn.selectedRepositories.length - usableRepos(conn).length
}
function statusText(conn: GithubConnection): string {
  if (conn.installationStatus === 'SUSPENDED') return '일시 중지'
  if (conn.installationStatus === 'DELETED') return '재연결 필요'
  if (revokedCount(conn)) return '접근 변경'
  if (!conn.selectedRepositories.length) return '저장소 미선택'
  return '연결됨'
}
function isWarnConn(conn: GithubConnection): boolean {
  // installationStatus 미수신(BE 미배포)이면 undefined → ACTIVE 로 취급(명시적 SUSPENDED/DELETED 만 경고)
  return conn.installationStatus === 'SUSPENDED' || conn.installationStatus === 'DELETED' || !!revokedCount(conn) || !conn.selectedRepositories.length
}
/** 카드 상단 알림 문구 — 설치 상태/접근 변경에 따라. 없으면 '' */
function connNotice(conn: GithubConnection): string {
  if (conn.installationStatus === 'SUSPENDED')
    return 'GitHub에서 앱 사용이 일시 중지되었습니다. 이 설치를 사용하는 모든 공간의 동기화가 중단됩니다.'
  if (conn.installationStatus === 'DELETED')
    return 'GitHub에서 앱 설치가 삭제되었습니다. 기존 Case 기록은 유지되며, 다시 연결하려면 설치와 저장소 선택이 필요합니다.'
  const revoked = revokedCount(conn)
  if (revoked) return `선택한 저장소 중 ${revoked}개의 GitHub 접근 권한이 사라졌습니다. 접근 가능한 나머지 저장소는 계속 사용할 수 있어요.`
  return ''
}
function repoUrl(fullName: string): string {
  return 'https://github.com/' + fullName.split('/').map(encodeURIComponent).join('/')
}
function repoName(fullName: string): string {
  const i = fullName.indexOf('/')
  return i === -1 ? fullName : fullName.slice(i + 1)
}
function manageUrl(conn: GithubConnection): string {
  const login = encodeURIComponent(conn.accountLogin)
  return conn.accountType === 'Organization'
    ? `https://github.com/organizations/${login}/settings/installations/${conn.installationId}`
    : `https://github.com/settings/installations/${conn.installationId}`
}
function connectedDate(at: string): string {
  if (!at) return ''
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return at
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const visible = computed(() =>
  connections.value.filter(c => {
    const key = spaceKey(c)
    if (filter.value === 'all') return true
    if (filter.value === 'team') return c.workspaceId !== null
    return key === filter.value
  }),
)
const useCompact = computed(
  () => filter.value === 'all' || filter.value === 'team' || visible.value.length >= 2,
)
const isIndividualFilter = computed(() => filter.value !== 'all' && filter.value !== 'team')

const filterTabs = computed(() => [
  { scope: 'all', text: '전체', count: connections.value.length },
  { scope: 'personal', text: 'Personal', count: connections.value.filter(c => c.workspaceId === null).length },
  { scope: 'team', text: '워크스페이스 전체', count: connections.value.filter(c => c.workspaceId !== null).length },
])
function wsCount(workspaceId: number): number {
  return connections.value.filter(c => c.workspaceId === workspaceId).length
}

// 검색/페이지네이션이 반영된 compact 뷰 데이터
const compactFiltered = computed(() => {
  const q = compactSearch.value.trim().toLocaleLowerCase()
  if (!q) return visible.value
  return visible.value.filter(c => {
    const hay = [
      scopeLabel(spaceKey(c)),
      c.accountLogin,
      c.workspaceId === null ? 'Personal' : 'Workspace',
      ...c.selectedRepositories.map(r => repoName(r.fullName)),
    ]
      .join(' ')
      .toLocaleLowerCase()
    return hay.includes(q)
  })
})
const compactPages = computed(() => Math.max(1, Math.ceil(compactFiltered.value.length / PAGE_SIZE)))
const compactPageItems = computed(() => {
  const page = Math.max(0, Math.min(compactPage.value, compactPages.value - 1))
  return compactFiltered.value.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
})
const pageNumbers = computed(() => {
  const pages = compactPages.value
  return Array.from({ length: pages }, (_, i) => i).filter(
    i => pages <= 7 || i === 0 || i === pages - 1 || Math.abs(i - compactPage.value) <= 1,
  )
})
const compactScopes = computed(() => new Set(visible.value.map(spaceKey)).size)
const compactTitle = computed(() =>
  filter.value === 'all'
    ? '전체 연결 현황'
    : filter.value === 'team'
      ? '워크스페이스 연결 현황'
      : `${scopeLabel(filter.value)} 연결 현황`,
)
const compactSelectedTotal = computed(() =>
  visible.value.reduce((sum, c) => sum + c.selectedRepositories.length, 0),
)

// 카드 저장소 검색(개별 연결)
function cardRepoRows(conn: GithubConnection) {
  const q = (cardSearch[conn.connectionId] || '').trim().toLowerCase()
  const grant = new Set(conn.availableRepositories.map(r => r.repoId))
  return conn.selectedRepositories
    .filter(r => !q || r.fullName.toLowerCase().includes(q))
    .map(r => ({ ...r, revoked: !grant.has(r.repoId) }))
}

// ───────────────────────── 조회 ─────────────────────────
let operation = 0
async function loadConnections(): Promise<boolean> {
  try {
    const { data } = await githubConnectionApi.listConnections()
    connections.value = data.filter(c => c.status === 'ACTIVE')
    loaded.value = true
    listError.value = false
    return true
  } catch {
    listError.value = true
    return false
  }
}
async function refreshList(withToast: boolean) {
  if (busy.value) return
  busy.value = true
  const ok = await loadConnections()
  busy.value = false
  if (ok && withToast) toast('연결 목록을 새로 불러왔어요.')
}

// ───────────────────────── 토스트 ─────────────────────────
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function toast(message: string) {
  toastMsg.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 3500)
}

// ───────────────────────── 다이얼로그 / 연결 흐름 ─────────────────────────
type DialogView =
  | null
  | 'scope'
  | 'authorize'
  | 'accounts'
  | 'repos'
  | 'confirm'
  | 'progress'
  | 'success'
  | 'error'
  | 'disconnect'
  | 'about'
type ErrorKind = 'expired' | 'forbidden' | 'conflict' | 'unavailable'

interface DraftRepo {
  repoId: number
  fullName: string
  isPrivate: boolean
  selectable: boolean
}
interface Draft {
  scope: string
  connectionId: number | null
  installationId: number | null
  accountLogin: string
  candidateToken: string | null
  version: number | null
  available: DraftRepo[]
  selected: number[]
  shareable: boolean
  updated: boolean
}

const dialogEl = ref<HTMLDialogElement | null>(null)
const view = ref<DialogView>(null)
const draft = ref<Draft | null>(null)
const candidates = ref<GithubConnectionCandidate[]>([])
const starting = ref(false)
const saving = ref(false)
const errorView = ref<ErrorKind>('expired')

const steps = ['연결 공간', 'GitHub 계정', '저장소 선택', '확인']
const wideDialog = computed(() => view.value === 'accounts' || view.value === 'repos')

const errorCopy: Record<ErrorKind, { title: string; message: string }> = {
  expired: { title: '연결 요청이 만료되었어요', message: '연결 공간과 계정을 다시 확인한 뒤 시도해 주세요.' },
  forbidden: { title: '연결 권한을 확인해 주세요', message: '공간 관리 권한 또는 저장소 공유 권한을 확인할 수 없어요.' },
  conflict: { title: '이미 연결된 설치예요', message: '이 설치는 이 공간에 이미 연결되어 있습니다. 목록에서 저장소 선택을 변경해 주세요.' },
  unavailable: { title: 'GitHub에 연결하지 못했어요', message: '일시적으로 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.' },
}
function errorKind(e: unknown): ErrorKind {
  const status = isAxiosError(e) ? e.response?.status : undefined
  if (status === 400) return 'expired'
  if (status === 403) return 'forbidden'
  if (status === 409) return 'conflict'
  return 'unavailable'
}

async function openDialog(next: Exclude<DialogView, null>) {
  view.value = next
  const d = dialogEl.value
  if (d && !d.open) d.showModal()
  await nextTick()
  d?.scrollTo(0, 0)
  d?.querySelector<HTMLElement>('#gh-dialog-title')?.focus({ preventScroll: true })
}
function closeDialog() {
  dialogEl.value?.close()
}
function onDialogClose() {
  view.value = null
  draft.value = null
  if (route.name === 'githubCallback') router.replace({ name: 'settingsIntegrations' })
}
function onDialogClick(event: MouseEvent) {
  const d = dialogEl.value
  if (!d || event.target !== d) return
  const r = d.getBoundingClientRect()
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog()
}

const dialogInstallLabel = computed(() => draft.value?.accountLogin ?? '')
const draftScopeLabel = computed(() => (draft.value ? scopeLabel(draft.value.scope) : ''))

// ── 연결 시작 ──
function startConnect() {
  if (isGuest.value) return
  const scope = isIndividualFilter.value && canScope(filter.value) ? filter.value : 'personal'
  draft.value = {
    scope,
    connectionId: null,
    installationId: null,
    accountLogin: '',
    candidateToken: null,
    version: null,
    available: [],
    selected: [],
    shareable: true,
    updated: false,
  }
  openDialog('scope')
}

/** "GitHub에서 계속" — 연결 옵션(저장 토큰 재사용 여부)에 따라 바로 후보로 가거나 GitHub 로 이동. */
async function continueToGithub() {
  const d = draft.value
  if (!d || starting.value) return
  if (!canScope(d.scope)) {
    toast('워크스페이스 관리자 권한을 확인해 주세요.')
    return
  }
  starting.value = true
  const workspaceId = wsScopeId(d.scope)
  try {
    const { data } = await githubConnectionApi.getConnectionOptions(workspaceId)
    if (data.status === 'VERIFIED_AVAILABLE') {
      starting.value = false
      openAccounts(data.candidates)
      return
    }
    if (data.status === 'NOT_AUTHORIZED' && data.authorizeUrl) {
      window.location.assign(data.authorizeUrl)
      return
    }
    if (data.status === 'VERIFIED_EMPTY' && data.installUrl) {
      window.location.assign(data.installUrl)
      return
    }
    starting.value = false
    callbackError('unavailable')
  } catch (e) {
    starting.value = false
    callbackError(errorKind(e))
  }
}

function openAccounts(list: GithubConnectionCandidate[]) {
  candidates.value = list
  if (draft.value) {
    draft.value.installationId = null
    draft.value.candidateToken = null
    draft.value.selected = []
  }
  openDialog('accounts')
}

function candidateShareable(cand: GithubConnectionCandidate): boolean {
  return cand.repositories.some(r => r.eligible)
}
function existingConnectionFor(installationId: number, scope: string): GithubConnection | undefined {
  return connections.value.find(c => c.installationId === installationId && spaceKey(c) === scope)
}
function candidateSubtitle(cand: GithubConnectionCandidate): string {
  const kind = cand.accountType === 'Organization' ? 'Organization' : 'Personal account'
  return candidateShareable(cand)
    ? `${kind} · ${cand.repositories.length}개 저장소 접근 가능`
    : `${kind} · 공간에 공유할 권한이 필요해요`
}

function pickCandidate(cand: GithubConnectionCandidate) {
  const d = draft.value
  if (!d || !candidateShareable(cand)) return
  d.installationId = cand.installationId
  d.accountLogin = cand.accountLogin
  d.candidateToken = cand.candidateToken
  d.connectionId = null
  d.version = null
  d.shareable = true
  d.available = cand.repositories.map(mapCandidateRepo)
  d.selected = []
}
function mapCandidateRepo(r: GithubCandidateRepository): DraftRepo {
  return { repoId: r.repoId, fullName: r.fullName, isPrivate: r.isPrivate, selectable: r.eligible }
}

function toRepos() {
  const d = draft.value
  if (!d || !d.installationId) return
  openDialog('repos')
}
function toggleRepo(repoId: number, checked: boolean) {
  const d = draft.value
  if (!d) return
  d.selected = checked ? [...new Set([...d.selected, repoId])] : d.selected.filter(x => x !== repoId)
}
function selectAll() {
  const d = draft.value
  if (!d) return
  d.selected = d.available.filter(r => r.selectable).map(r => r.repoId)
}
const confirmSelectedRepos = computed(() => {
  const d = draft.value
  if (!d) return []
  return d.available.filter(a => d.selected.includes(a.repoId))
})
const removedOnEdit = computed(() => {
  const d = draft.value
  if (!d || !d.connectionId) return 0
  const conn = connections.value.find(c => c.connectionId === d.connectionId)
  if (!conn) return 0
  return conn.selectedRepositories.filter(r => !d.selected.includes(r.repoId)).length
})

// ── 연결 관리(기존 연결의 저장소 변경) ──
function editConnection(conn: GithubConnection) {
  if (!canScope(spaceKey(conn))) {
    toast('이 공간의 관리자 권한이 필요해요.')
    return
  }
  draft.value = {
    scope: spaceKey(conn),
    connectionId: conn.connectionId,
    installationId: conn.installationId,
    accountLogin: conn.accountLogin,
    candidateToken: null,
    version: conn.version,
    available: conn.availableRepositories.map(r => ({
      repoId: r.repoId,
      fullName: r.fullName,
      isPrivate: r.isPrivate,
      selectable: true,
    })),
    selected: conn.selectedRepositories.map(r => r.repoId).filter(id => conn.availableRepositories.some(a => a.repoId === id)),
    shareable: true,
    updated: false,
  }
  openDialog('repos')
}
function editCandidateConnection(cand: GithubConnectionCandidate) {
  const existing = draft.value ? existingConnectionFor(cand.installationId, draft.value.scope) : undefined
  if (existing) editConnection(existing)
}

function confirmStep() {
  openDialog('confirm')
}

async function save() {
  const d = draft.value
  if (!d || saving.value) return
  if (!canScope(d.scope)) {
    toast('공간 관리 권한을 확인해 주세요.')
    return
  }
  saving.value = true
  const id = ++operation
  d.updated = d.connectionId !== null
  openDialog('progress')
  try {
    if (d.connectionId !== null) {
      await githubConnectionApi.updateRepositories(d.connectionId, d.selected, d.version)
    } else {
      if (!d.candidateToken) throw new Error('missing candidate token')
      await githubConnectionApi.createConnection(d.candidateToken, d.selected)
    }
    if (id !== operation) return
    await loadConnections()
    if (id !== operation) return
    saving.value = false
    filter.value = d.scope
    openDialog('success')
  } catch (e) {
    if (id !== operation) return
    saving.value = false
    if (d.connectionId !== null && isAxiosError(e) && e.response?.status === 409) {
      await loadConnections()
      callbackError('conflict')
      return
    }
    callbackError(errorKind(e))
  }
}

function finishSuccess() {
  closeDialog()
}

// ── 해제 ──
function askDisconnect(conn: GithubConnection) {
  if (!canScope(spaceKey(conn))) return
  draft.value = {
    scope: spaceKey(conn),
    connectionId: conn.connectionId,
    installationId: conn.installationId,
    accountLogin: conn.accountLogin,
    candidateToken: null,
    version: conn.version,
    available: [],
    selected: [],
    shareable: true,
    updated: false,
  }
  openDialog('disconnect')
}
async function confirmDisconnect() {
  const d = draft.value
  if (!d || d.connectionId === null || saving.value) return
  saving.value = true
  const name = scopeLabel(d.scope)
  try {
    await githubConnectionApi.disconnect(d.connectionId)
    await loadConnections()
    saving.value = false
    closeDialog()
    toast(`${name}의 연결을 해제했어요. 다른 공간은 계속 사용할 수 있습니다.`)
  } catch (e) {
    saving.value = false
    callbackError(errorKind(e))
  }
}

// ── 새 설치(다른 GitHub 계정) / GitHub 설치 설정 ──
async function installNewAccount() {
  const d = draft.value
  const workspaceId = d ? wsScopeId(d.scope) : null
  try {
    const { data } = await githubConnectionApi.getConnectionOptions(workspaceId)
    if (data.installUrl) {
      window.location.assign(data.installUrl)
      return
    }
    if (data.authorizeUrl) {
      window.location.assign(data.authorizeUrl)
      return
    }
    callbackError('unavailable')
  } catch (e) {
    callbackError(errorKind(e))
  }
}

/** DELETED 설치를 이 공간에 다시 연결 — GitHub 설치(또는 인가)로 이동. 복귀하면 설치 콜백이 저장소 선택·확인 흐름을 탄다. */
async function reinstall(conn: GithubConnection) {
  if (!canScope(spaceKey(conn))) return
  try {
    const { data } = await githubConnectionApi.getConnectionOptions(conn.workspaceId)
    if (data.installUrl) {
      window.location.assign(data.installUrl)
      return
    }
    if (data.authorizeUrl) {
      window.location.assign(data.authorizeUrl)
      return
    }
    callbackError('unavailable')
  } catch (e) {
    callbackError(errorKind(e))
  }
}

// ── 에러 ──
function callbackError(kind: ErrorKind) {
  errorView.value = kind
  openDialog('error')
}
function errorRetry() {
  if (draft.value?.connectionId) {
    openDialog('repos')
  } else {
    closeDialog()
  }
}

// ───────────────────────── 콜백 처리 ─────────────────────────
const handledCodes = new Set<string>()
async function handleCallback() {
  const q = route.query
  const installationId = Number(q.installation_id)
  const code = typeof q.code === 'string' ? q.code : ''
  const state = typeof q.state === 'string' ? q.state : ''
  const setupAction = typeof q.setup_action === 'string' ? q.setup_action : ''
  await router.replace({ name: 'githubCallback' })

  // GitHub Configure 에서 접근 범위만 바꾸고 돌아온 경우 — 설치 grant 재동기화.
  if (setupAction === 'update' && !state) {
    await router.replace({ name: 'settingsIntegrations' })
    if (installationId) {
      try {
        const { data } = await githubConnectionApi.refreshRepositories(installationId)
        await loadConnections()
        const added = data.addedRepoIds.length
        const removed = data.removedRepoIds.length
        if (added || removed) toast(`GitHub 접근 범위를 반영했어요. 새 저장소 ${added}개 · 해제 ${removed}개.`)
        else toast('GitHub에서 변경한 저장소 범위를 확인했어요.')
      } catch {
        await refreshList(false)
      }
    }
    return
  }
  if (!code || !state) return callbackError('expired')
  if (handledCodes.has(code)) return
  handledCodes.add(code)

  const id = ++operation
  // 신규 설치 콜백(installation_id 동봉)도, 기존 설치 OAuth 콜백도 모두 후보 흐름으로 처리한다.
  // 설치 직후에도 "이 공간에 쓸 저장소 선택 → 연결 확인" 단계를 거친다(전체 grant 자동 연결 X).
  openDialog('progress')
  try {
    const { data } = await githubConnectionApi.getCandidates(code, state)
    if (id !== operation) return
    draft.value = {
      scope: data.workspaceId === null ? 'personal' : `ws:${data.workspaceId}`,
      connectionId: null,
      installationId: null,
      accountLogin: '',
      candidateToken: null,
      version: null,
      available: [],
      selected: [],
      shareable: true,
      updated: false,
    }
    // 방금 설치한 계정(installation_id 일치)이 있으면 자동 선택 후 저장소 선택 단계로 바로 보낸다.
    const justInstalled = installationId
      ? data.candidates.find(c => c.installationId === installationId)
      : undefined
    if (justInstalled && candidateShareable(justInstalled)) {
      candidates.value = data.candidates
      pickCandidate(justInstalled)
      toRepos()
    } else {
      openAccounts(data.candidates)
    }
  } catch (e) {
    if (id !== operation) return
    callbackError(errorKind(e))
  }
}

function openConnections() {
  emit('open-connections')
}

onMounted(async () => {
  if (isGuest.value || featureOff) return
  if (!teamStore.workspaces.length) await teamStore.fetchWorkspaces().catch(() => {})
  await loadConnections()
  if (route.name === 'githubCallback') await handleCallback()
})
</script>

<template>
  <div class="gh-int gh2">
    <div class="page-heading row between">
      <div>
        <h1>Integrations</h1>
        <p>개발 도구와 연결하고, 에러 기록의 맥락을 이어가세요.</p>
      </div>
      <div class="heading-end !mt-0"><span class="set-chip bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Workspace &amp; Personal</span></div>
    </div>

    <!-- 게스트 / 기능 off -->
    <div v-if="isGuest" class="empty">
      <div class="empty-graphic"><span class="graphic-icon"><GhIcon name="lock" /></span></div>
      <h3>로그인 후 GitHub를 연결할 수 있어요</h3>
      <p>계정으로 로그인해 개인 또는 팀의 저장소를 연결하세요.</p>
      <button type="button" class="button primary" @click="startSignup">가입하기 <GhIcon name="arrow" /></button>
    </div>
    <div v-else-if="featureOff" class="empty">
      <div class="empty-graphic"><GhIcon name="github" /></div>
      <h3>GitHub 연동을 준비하고 있어요</h3>
      <p>아직 이 환경에서 GitHub 연동을 사용할 수 없습니다.</p>
      <span class="pill">준비 중</span>
    </div>

    <template v-else>
      <!-- 개요 -->
      <div class="integration-overview">
        <div class="row">
          <div class="service-icon"><GhIcon name="github" /></div>
          <div class="grow">
            <div class="row"><h2 class="service-name">GitHub</h2><span class="pill">App</span></div>
            <p class="service-desc">같은 GitHub 계정을 여러 공간에 연결하고, 공간마다 사용할 저장소를 선택하세요.</p>
          </div>
          <button type="button" class="button primary" @click="startConnect"><GhIcon name="plus" />GitHub 연결</button>
        </div>
        <div class="overview-foot">
          <span class="row"><GhIcon name="shield" />선택한 저장소의 정보만 연결한 공간에서 사용합니다.</span>
          <button type="button" class="text-button" @click="openDialog('about')">연동 알아보기 <GhIcon name="chevron" /></button>
        </div>
      </div>

      <div v-if="workspaces.length && !isAdminOfAny" class="notice">
        <GhIcon name="info" />
        <div>팀 연결은 현재 워크스페이스 관리자만 변경할 수 있어요. Personal 연결은 직접 추가할 수 있습니다.</div>
      </div>

      <div class="section-heading">
        <h2>연결 목록 <span>{{ loaded ? connections.length : '—' }}</span></h2>
        <button type="button" class="text-button" :disabled="busy" @click="refreshList(true)"><GhIcon name="refresh" class="sm" />목록 새로고침</button>
      </div>

      <!-- 범위 필터 -->
      <div v-if="loaded" class="filter-tabs gh2-scope-toolbar" role="group" aria-label="연결 범위 필터">
        <button
          v-for="t in filterTabs"
          :key="t.scope"
          type="button"
          class="filter-tab"
          :class="{ active: filter === t.scope }"
          :aria-pressed="filter === t.scope"
          @click="(filter = t.scope), (expandedId = null), (compactSearch = ''), (compactPage = 0)"
        >
          {{ t.text }}<span>{{ t.count }}</span>
        </button>
        <label class="gh2-workspace-select">
          <GhIcon name="users" />
          <span class="sr-only">개별 워크스페이스 선택</span>
          <select
            aria-label="개별 워크스페이스 선택"
            :value="filter.startsWith('ws:') ? filter : ''"
            @change="(filter = ($event.target as HTMLSelectElement).value || 'all'), (expandedId = null), (compactSearch = ''), (compactPage = 0)"
          >
            <option value="">워크스페이스 선택</option>
            <option v-for="w in workspaces" :key="w.workspaceId" :value="`ws:${w.workspaceId}`">
              {{ w.name }} · {{ wsCount(w.workspaceId) }}
            </option>
          </select>
          <GhIcon name="chevron" />
        </label>
      </div>

      <!-- 조회 실패 -->
      <div
        v-if="listError"
        class="gh-list-error"
        :class="loaded ? 'gh-list-error-inline' : 'gh-list-error-full'"
        role="alert"
      >
        <GhIcon name="alert" />
        <div class="grow">
          <strong>{{ loaded ? '최신 목록을 확인하지 못했어요' : '연결 목록을 불러오지 못했어요' }}</strong>
          <p>서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.</p>
          <small>{{ loaded ? '아래는 이전 조회 결과입니다.' : '연결 여부를 확인할 수 없습니다. 처음 연결하는 상태와는 달라요.' }}</small>
        </div>
        <button type="button" class="button" :disabled="busy" @click="refreshList(false)">다시 시도</button>
      </div>

      <!-- 목록 본문 -->
      <template v-if="loaded">
        <!-- compact 테이블 -->
        <section v-if="visible.length && useCompact" class="gh2-compact" :aria-label="compactTitle">
          <div class="gh2-compact-top">
            <div>
              <div class="gh2-compact-kicker">CONNECTION OVERVIEW</div>
              <h3>{{ compactTitle }} <span class="gh2-count-pill">{{ visible.length }}</span></h3>
              <p>{{ isIndividualFilter ? '연결된 GitHub 계정을 선택하면 해당 공간의 저장소와 관리 기능이 열립니다.' : '공간별 연결을 한눈에 살펴보세요. 항목을 누르면 저장소와 관리 기능이 열립니다.' }}</p>
            </div>
            <div class="gh2-compact-totals">
              <span><GhIcon :name="isIndividualFilter ? 'github' : 'users'" /> {{ isIndividualFilter ? `${visible.length}개 GitHub 계정` : `${compactScopes}개 공간` }}</span>
              <span><GhIcon name="repo" /> 저장소 {{ compactSelectedTotal }}개 선택</span>
            </div>
          </div>
          <div class="gh2-compact-search-wrap">
            <label class="gh2-compact-search">
              <GhIcon name="search" />
              <span class="sr-only">{{ isIndividualFilter ? 'GitHub 계정과 저장소' : '공간, 계정, 저장소' }} 이름 검색</span>
              <input
                type="search"
                :value="compactSearch"
                :placeholder="isIndividualFilter ? 'GitHub 계정 · 저장소 검색' : '공간 · GitHub 계정 · 저장소 검색'"
                autocomplete="off"
                @input="(compactSearch = ($event.target as HTMLInputElement).value), (compactPage = 0), (expandedId = null)"
              />
            </label>
            <span class="gh2-compact-result-count">{{ compactSearch.trim() ? `검색 결과 ${compactFiltered.length}건` : `총 ${visible.length}개 연결` }}</span>
          </div>
          <div class="gh2-compact-list">
            <div class="gh2-compact-columns" aria-hidden="true">
              <span>연결 공간</span><span>GitHub 계정</span><span>선택한 저장소</span><span>상태</span><span></span>
            </div>
            <template v-if="compactPageItems.length">
              <div v-for="c in compactPageItems" :key="c.connectionId" class="gh2-compact-item">
                <button
                  type="button"
                  class="gh2-compact-row"
                  :class="{ 'is-open': expandedId === c.connectionId }"
                  :aria-expanded="expandedId === c.connectionId"
                  @click="expandedId = expandedId === c.connectionId ? null : c.connectionId"
                >
                  <span class="gh2-compact-space">
                    <span class="gh2-compact-space-icon"><GhIcon :name="c.workspaceId === null ? 'user' : 'users'" /></span>
                    <span class="gh2-compact-text"><strong>{{ scopeLabel(spaceKey(c)) }}</strong><small>{{ c.workspaceId === null ? 'Personal' : 'Workspace' }}</small></span>
                  </span>
                  <span class="gh2-compact-account">
                    <span class="gh2-compact-account-icon"><GhIcon :name="c.accountType === 'Organization' ? 'building' : 'user'" /></span>
                    <span class="gh2-compact-text"><strong>{{ c.accountLogin }}</strong><small>{{ c.accountType === 'Organization' ? 'Organization' : 'Personal account' }}</small></span>
                  </span>
                  <span class="gh2-compact-repo">
                    <strong>{{ c.selectedRepositories.length }}개</strong>
                    <small>{{ revokedCount(c) ? `${revokedCount(c)}개 접근 해제` : '저장소 선택' }}</small>
                  </span>
                  <span class="gh2-compact-status" :class="isWarnConn(c) ? 'warn' : 'good'"><span class="dot"></span>{{ statusText(c) }}</span>
                  <span class="gh2-compact-open">{{ expandedId === c.connectionId ? '접기' : '상세' }} <GhIcon name="chevron" /></span>
                </button>
                <div v-if="expandedId === c.connectionId" class="gh2-compact-detail">
                  <div class="gh2-compact-detail-title">
                    <strong>{{ scopeLabel(spaceKey(c)) }} · {{ c.accountLogin }}</strong>
                    <span>이 공간에서 선택한 저장소와 관리 기능</span>
                  </div>
                  <article class="installation">
                    <div class="installation-head">
                      <div class="row">
                        <div class="account-icon"><GhIcon :name="c.accountType === 'Organization' ? 'building' : 'user'" /></div>
                        <div class="grow"><h3 class="account-name">{{ c.accountLogin }}</h3><p class="account-type">GitHub {{ c.accountType === 'Organization' ? 'Organization' : 'Personal account' }}</p></div>
                        <span class="pill" :class="isWarnConn(c) ? 'amber' : 'green'"><span class="dot"></span>{{ statusText(c) }}</span>
                      </div>
                      <div class="install-meta">
                        <span class="row"><GhIcon :name="c.workspaceId === null ? 'user' : 'users'" /><strong>{{ scopeLabel(spaceKey(c)) }}</strong></span><span class="pill">{{ c.workspaceId === null ? 'Personal' : 'Workspace' }}</span>
                        <span class="meta-divider"></span><span class="date">{{ connectedDate(c.connectedAt) }} 연결</span>
                      </div>
                    </div>
                    <div v-if="connNotice(c)" class="notice amber">
                      <GhIcon name="info" /><div>{{ connNotice(c) }}</div>
                    </div>
                    <div class="repository-area">
                      <div class="repository-head">
                        <h3>이 공간의 저장소 <span>{{ c.selectedRepositories.length }}개</span></h3>
                        <label class="search-wrap">
                          <GhIcon name="search" /><span class="sr-only">{{ scopeLabel(spaceKey(c)) }} 저장소 검색</span>
                          <input :value="cardSearch[c.connectionId] || ''" placeholder="저장소 검색" autocomplete="off" @input="cardSearch[c.connectionId] = ($event.target as HTMLInputElement).value" />
                        </label>
                      </div>
                      <div class="gh2-repo-results">
                        <div v-if="!cardRepoRows(c).length" class="repo-empty">
                          <GhIcon :name="(cardSearch[c.connectionId] || '').trim() ? 'search' : 'repo'" />
                          <strong>{{ (cardSearch[c.connectionId] || '').trim() ? '검색 결과가 없어요' : '이 공간에 선택한 저장소가 없어요' }}</strong>
                          <p>{{ (cardSearch[c.connectionId] || '').trim() ? '다른 저장소 이름으로 검색해 보세요.' : '저장소 선택 변경에서 이 공간에 사용할 저장소를 골라 주세요.' }}</p>
                        </div>
                        <div v-for="r in cardRepoRows(c)" v-else :key="r.repoId" class="repo-row" :class="{ 'gh2-revoked': r.revoked }">
                          <GhIcon :name="r.revoked ? 'lock' : 'repo'" />
                          <div class="repo-info">
                            <template v-if="r.revoked">
                              <span class="repo-name">접근할 수 없는 저장소</span><span class="pill amber">동기화 중단</span>
                            </template>
                            <template v-else>
                              <a class="repo-name" :href="repoUrl(r.fullName)" target="_blank" rel="noopener noreferrer"><span class="repo-owner">{{ c.accountLogin }} / </span>{{ repoName(r.fullName) }}</a>
                              <span class="pill"><GhIcon v-if="r.isPrivate" name="lock" />{{ r.isPrivate ? 'Private' : 'Public' }}</span>
                            </template>
                          </div>
                          <a v-if="!r.revoked" class="icon-button" :href="repoUrl(r.fullName)" target="_blank" rel="noopener noreferrer" :aria-label="`${repoName(r.fullName)} GitHub에서 열기`"><GhIcon name="external" /></a>
                        </div>
                      </div>
                    </div>
                    <div class="repository-footer gh2-footer">
                      <span class="row"><GhIcon name="users" />이 공간에서 사용하는 저장소만 표시됩니다.</span>
                      <div v-if="canScope(spaceKey(c))" class="gh2-actions">
                        <button type="button" class="text-button" @click="editConnection(c)">저장소 선택 변경</button>
                        <button type="button" class="text-button gh2-muted-action" @click="askDisconnect(c)">이 공간에서 연결 해제</button>
                      </div>
                      <span v-else>워크스페이스 관리자만 변경 가능</span>
                    </div>
                    <div class="gh2-install-settings">
                      <span>{{ connections.filter(x => x.installationId === c.installationId).length > 1 ? '다른 공간에서도 이 GitHub 설치를 사용하고 있어요.' : 'GitHub가 앱에 허용한 접근 범위를 관리합니다.' }}</span>
                      <button v-if="c.installationStatus === 'DELETED'" type="button" class="text-button" :disabled="!canScope(spaceKey(c))" @click="reinstall(c)">이 공간에 다시 연결 <GhIcon name="external" /></button><a v-else class="text-button" :href="manageUrl(c)" target="_blank" rel="noopener noreferrer">GitHub 설치 설정 <GhIcon name="external" /></a>
                    </div>
                  </article>
                </div>
              </div>
            </template>
            <div v-else class="gh2-compact-no-results">
              <GhIcon name="search" /><strong>검색 결과가 없어요</strong><p>다른 공간이나 GitHub 계정 이름으로 검색해 보세요.</p>
            </div>
          </div>
          <div v-if="compactPages > 1" class="gh2-compact-pagination">
            <span>{{ compactFiltered.length }}개 중 {{ compactPage * PAGE_SIZE + 1 }}–{{ Math.min((compactPage + 1) * PAGE_SIZE, compactFiltered.length) }}개 표시</span>
            <div>
              <button type="button" class="button ghost" :disabled="compactPage === 0" @click="compactPage = compactPage - 1"><GhIcon name="chevron" /> 이전</button>
              <button
                v-for="n in pageNumbers"
                :key="n"
                type="button"
                class="gh2-page-number"
                :class="{ current: n === compactPage }"
                :aria-current="n === compactPage ? 'page' : undefined"
                @click="compactPage = n"
              >{{ n + 1 }}</button>
              <button type="button" class="button ghost" :disabled="compactPage >= compactPages - 1" @click="compactPage = compactPage + 1">다음 <GhIcon name="chevron" /></button>
            </div>
          </div>
        </section>

        <!-- 단일 카드(개별 필터 · 1건) -->
        <article v-for="c in (visible.length && !useCompact ? visible : [])" :key="c.connectionId" class="installation">
          <div class="installation-head">
            <div class="row">
              <div class="account-icon"><GhIcon :name="c.accountType === 'Organization' ? 'building' : 'user'" /></div>
              <div class="grow"><h3 class="account-name">{{ c.accountLogin }}</h3><p class="account-type">GitHub {{ c.accountType === 'Organization' ? 'Organization' : 'Personal account' }}</p></div>
              <span class="pill" :class="isWarnConn(c) ? 'amber' : 'green'"><span class="dot"></span>{{ statusText(c) }}</span>
            </div>
            <div class="install-meta">
              <span class="row"><GhIcon :name="c.workspaceId === null ? 'user' : 'users'" /><strong>{{ scopeLabel(spaceKey(c)) }}</strong></span><span class="pill">{{ c.workspaceId === null ? 'Personal' : 'Workspace' }}</span>
              <span class="meta-divider"></span><span class="date">{{ connectedDate(c.connectedAt) }} 연결</span>
            </div>
          </div>
          <div v-if="connNotice(c)" class="notice amber">
            <GhIcon name="info" /><div>{{ connNotice(c) }}</div>
          </div>
          <div class="repository-area">
            <div class="repository-head">
              <h3>이 공간의 저장소 <span>{{ c.selectedRepositories.length }}개</span></h3>
              <label class="search-wrap">
                <GhIcon name="search" /><span class="sr-only">{{ scopeLabel(spaceKey(c)) }} 저장소 검색</span>
                <input :value="cardSearch[c.connectionId] || ''" placeholder="저장소 검색" autocomplete="off" @input="cardSearch[c.connectionId] = ($event.target as HTMLInputElement).value" />
              </label>
            </div>
            <div class="gh2-repo-results">
              <div v-if="!cardRepoRows(c).length" class="repo-empty">
                <GhIcon :name="(cardSearch[c.connectionId] || '').trim() ? 'search' : 'repo'" />
                <strong>{{ (cardSearch[c.connectionId] || '').trim() ? '검색 결과가 없어요' : '이 공간에 선택한 저장소가 없어요' }}</strong>
                <p>{{ (cardSearch[c.connectionId] || '').trim() ? '다른 저장소 이름으로 검색해 보세요.' : '저장소 선택 변경에서 이 공간에 사용할 저장소를 골라 주세요.' }}</p>
              </div>
              <div v-for="r in cardRepoRows(c)" v-else :key="r.repoId" class="repo-row" :class="{ 'gh2-revoked': r.revoked }">
                <GhIcon :name="r.revoked ? 'lock' : 'repo'" />
                <div class="repo-info">
                  <template v-if="r.revoked"><span class="repo-name">접근할 수 없는 저장소</span><span class="pill amber">동기화 중단</span></template>
                  <template v-else>
                    <a class="repo-name" :href="repoUrl(r.fullName)" target="_blank" rel="noopener noreferrer"><span class="repo-owner">{{ c.accountLogin }} / </span>{{ repoName(r.fullName) }}</a>
                    <span class="pill"><GhIcon v-if="r.isPrivate" name="lock" />{{ r.isPrivate ? 'Private' : 'Public' }}</span>
                  </template>
                </div>
                <a v-if="!r.revoked" class="icon-button" :href="repoUrl(r.fullName)" target="_blank" rel="noopener noreferrer" :aria-label="`${repoName(r.fullName)} GitHub에서 열기`"><GhIcon name="external" /></a>
              </div>
            </div>
          </div>
          <div class="repository-footer gh2-footer">
            <span class="row"><GhIcon name="users" />이 공간에서 사용하는 저장소만 표시됩니다.</span>
            <div v-if="canScope(spaceKey(c))" class="gh2-actions">
              <button type="button" class="text-button" @click="editConnection(c)">저장소 선택 변경</button>
              <button type="button" class="text-button gh2-muted-action" @click="askDisconnect(c)">이 공간에서 연결 해제</button>
            </div>
            <span v-else>워크스페이스 관리자만 변경 가능</span>
          </div>
          <div class="gh2-install-settings">
            <span>{{ connections.filter(x => x.installationId === c.installationId).length > 1 ? '다른 공간에서도 이 GitHub 설치를 사용하고 있어요.' : 'GitHub가 앱에 허용한 접근 범위를 관리합니다.' }}</span>
            <button v-if="c.installationStatus === 'DELETED'" type="button" class="text-button" :disabled="!canScope(spaceKey(c))" @click="reinstall(c)">이 공간에 다시 연결 <GhIcon name="external" /></button><a v-else class="text-button" :href="manageUrl(c)" target="_blank" rel="noopener noreferrer">GitHub 설치 설정 <GhIcon name="external" /></a>
          </div>
        </article>

        <!-- 빈 상태 -->
        <div v-if="!visible.length" class="empty">
          <div class="empty-graphic"><span class="graphic-icon"><GhIcon name="github" /></span><span class="connector"></span><span class="graphic-icon ea">E</span></div>
          <h3>{{ filter === 'all' ? '첫 번째 GitHub 연결을 추가해 보세요' : filter === 'team' ? '워크스페이스에 연결된 GitHub 계정이 없어요' : `${scopeLabel(filter)}에 연결된 GitHub 계정이 없어요` }}</h3>
          <p>기존 GitHub 설치를 선택하거나 새로 설치한 뒤,<br />이 공간에서 사용할 저장소를 선택할 수 있어요.</p>
          <span v-if="filter.startsWith('ws:') && !canScope(filter)" class="pill">워크스페이스 관리자에게 연결을 요청해 주세요</span>
          <button v-else type="button" class="button" @click="startConnect"><GhIcon name="github" />GitHub 연결하기</button>
        </div>

        <div class="note">
          <GhIcon name="info" />
          <span>GitHub 로그인 계정과 저장소 연동은 별도로 관리됩니다.<br />로그인에 사용하는 계정은 <button type="button" class="text-button" style="font-size:inherit" @click="openConnections">Connections</button>에서 확인할 수 있어요.</span>
        </div>
        <div class="gh2-bottom-note"><GhIcon name="repo" />이 공간의 저장소는 Issue·PR·CI 근거 연결과 본문 # 자동완성에 사용됩니다.</div>
      </template>
    </template>

    <!-- 다이얼로그 -->
    <dialog
      ref="dialogEl"
      class="gh2-dialog"
      :class="{ wide: wideDialog }"
      aria-labelledby="gh-dialog-title"
      @close="onDialogClose"
      @click="onDialogClick"
    >
      <!-- draft 없이도 뜨는 화면(콜백 진행·에러·안내) -->
      <template v-if="view === 'progress'">
        <div class="modal-top"><div class="row"><GhIcon name="github" /><strong>연결 확인</strong></div><button type="button" class="icon-button" aria-label="닫기" @click="closeDialog"><GhIcon name="close" /></button></div>
        <div class="status-view"><div class="status-symbol"><span class="spinner"></span></div><h2 id="gh-dialog-title" tabindex="-1">연결 정보를 확인하고 있어요</h2><p>공간의 관리 권한과 선택한 저장소 접근 권한을 확인합니다.</p></div>
      </template>
      <template v-else-if="view === 'error'">
        <div class="modal-top"><div class="row"><GhIcon name="github" /><strong>GitHub 연결 확인</strong></div><button type="button" class="icon-button" aria-label="닫기" @click="closeDialog"><GhIcon name="close" /></button></div>
        <div class="status-view">
          <div class="status-symbol error"><GhIcon name="alert" /></div>
          <h2 id="gh-dialog-title" tabindex="-1">{{ errorCopy[errorView].title }}</h2>
          <p>{{ errorCopy[errorView].message }}</p>
          <div class="notice gh2-success-note">기존 연결과 저장소 선택은 변경되지 않았습니다.</div>
        </div>
        <div class="modal-actions"><button type="button" class="button ghost" @click="closeDialog">닫기</button><button type="button" class="button primary" @click="errorRetry">{{ draft?.connectionId ? '선택 다시 확인' : '다시 시도' }}</button></div>
      </template>
      <template v-else-if="view === 'about'">
        <div class="modal-top"><div class="row"><GhIcon name="github" /><strong>GitHub 연동 안내</strong></div><button type="button" class="icon-button" aria-label="닫기" @click="closeDialog"><GhIcon name="close" /></button></div>
        <div class="modal-inner">
          <h2 id="gh-dialog-title" tabindex="-1">저장소와 에러 기록 사이의 연결</h2>
          <p class="modal-intro">한 번 설치한 GitHub 앱을 여러 공간에서 사용할 수 있어요.</p>
          <div class="gh2-about-item"><GhIcon name="github" /><div><strong>GitHub 설치</strong><p>앱이 접근할 수 있는 계정과 저장소 범위입니다.</p></div></div>
          <div class="gh2-about-item"><GhIcon name="users" /><div><strong>공간별 연결</strong><p>허용된 저장소 중 Personal이나 각 팀에서 사용할 것을 따로 선택합니다.</p></div></div>
          <div class="gh2-about-item"><GhIcon name="repo" /><div><strong>Case 근거</strong><p>각 공간에서 선택한 Issue·PR을 Case에 연결합니다. 같은 저장소를 연결해도 다른 공간의 Case·댓글이 공유되지는 않습니다.</p></div></div>
          <p class="scope-hint">GitHub 설치 설정은 모든 연결 공간에 영향을 줄 수 있어요. 한 공간에서만 사용을 끝내려면 “이 공간에서 연결 해제”를 선택하세요.</p>
        </div>
        <div class="modal-actions"><span class="tiny muted">GitHub 로그인용 계정 연결과는 별개입니다.</span><button type="button" class="button primary" @click="closeDialog">확인</button></div>
      </template>

      <!-- draft 가 필요한 연결 흐름 -->
      <template v-else-if="view && draft">
        <!-- 공간 선택 -->
        <template v-if="view === 'scope'">
          <div class="modal-top"><div class="row"><GhIcon name="github" /><strong>GitHub 연결</strong></div><button type="button" class="icon-button" aria-label="닫기" @click="closeDialog"><GhIcon name="close" /></button></div>
          <div class="modal-inner">
            <div class="steps gh2-steps"><span v-for="(s, k) in steps" :key="s"><GhIcon v-if="k" name="chevron" /><span :class="{ current: k === 0 }"><span class="step-num">{{ k < 0 ? '✓' : k + 1 }}</span>{{ s }}</span></span></div>
            <h2 id="gh-dialog-title" tabindex="-1">어디에 연결할까요?</h2>
            <p class="modal-intro">이 연결에서 사용할 공간을 선택하세요.</p>
            <div class="gh2-options">
              <label class="scope-option">
                <span><GhIcon name="user" /></span>
                <div class="grow"><strong>Personal</strong><p>나만 사용하는 개인 공간에 연결합니다.</p></div>
                <input type="radio" name="gh2-scope" value="personal" :checked="draft.scope === 'personal'" @change="draft.scope = 'personal'" />
              </label>
              <label v-for="w in workspaces" :key="w.workspaceId" class="scope-option">
                <span><GhIcon name="users" /></span>
                <div class="grow"><strong>{{ w.name }} <span class="pill">{{ w.role === 'ADMIN' ? 'Admin' : 'Member' }}</span></strong><p>{{ w.role === 'ADMIN' ? '선택한 저장소의 정보를 이 워크스페이스 멤버와 공유합니다.' : '워크스페이스 관리자만 연결할 수 있어요.' }}</p></div>
                <input type="radio" name="gh2-scope" :value="`ws:${w.workspaceId}`" :checked="draft.scope === `ws:${w.workspaceId}`" :disabled="!canScope(`ws:${w.workspaceId}`)" @change="draft.scope = `ws:${w.workspaceId}`" />
              </label>
            </div>
            <p class="scope-hint"><GhIcon name="info" />같은 GitHub 계정을 여러 공간에 각각 연결할 수 있어요.</p>
          </div>
          <div class="modal-actions"><button type="button" class="button ghost" @click="closeDialog">취소</button><button type="button" class="button primary" @click="openDialog('authorize')">GitHub에서 계속 <GhIcon name="arrow" /></button></div>
        </template>

        <!-- GitHub 계정 확인(안내) -->
        <template v-else-if="view === 'authorize'">
          <div class="modal-top"><div class="row"><GhIcon name="github" /><strong>GitHub 계정 확인</strong></div><button type="button" class="icon-button" aria-label="닫기" @click="closeDialog"><GhIcon name="close" /></button></div>
          <div class="modal-inner">
            <div class="steps gh2-steps"><span v-for="(s, k) in steps" :key="s"><GhIcon v-if="k" name="chevron" /><span :class="{ current: k === 1 }"><span class="step-num">{{ k < 1 ? '✓' : k + 1 }}</span>{{ s }}</span></span></div>
            <h2 id="gh-dialog-title" tabindex="-1">GitHub 계정으로 계속</h2>
            <p class="modal-intro">GitHub App은 계정당 한 번만 설치하면 됩니다.</p>
            <p class="scope-hint"><GhIcon name="info" />이미 설치한 계정이면 다시 설치하지 않고 저장소만 고르면 돼요. 처음이라면 다음 화면에서 GitHub 설치를 진행합니다.</p>
          </div>
          <div class="modal-actions"><button type="button" class="button ghost" @click="openDialog('scope')">이전</button><button type="button" class="button primary" :disabled="starting" @click="continueToGithub">GitHub에서 계정 확인 <GhIcon name="arrow" /></button></div>
        </template>

        <!-- 계정(후보) 선택 -->
        <template v-else-if="view === 'accounts'">
          <div class="modal-top"><div class="row"><GhIcon name="github" /><strong>GitHub 계정 선택</strong></div><button type="button" class="icon-button" aria-label="닫기" @click="closeDialog"><GhIcon name="close" /></button></div>
          <div class="modal-inner">
            <div class="steps gh2-steps"><span v-for="(s, k) in steps" :key="s"><GhIcon v-if="k" name="chevron" /><span :class="{ current: k === 1 }"><span class="step-num">{{ k < 1 ? '✓' : k + 1 }}</span>{{ s }}</span></span></div>
            <h2 id="gh-dialog-title" tabindex="-1">연결할 설치 선택</h2>
            <p class="modal-intro">GitHub 인가로 불러온, <strong>{{ draftScopeLabel }}</strong>에 연결 가능한 설치입니다.</p>
            <div v-if="candidates.length" class="gh2-options">
              <div v-for="x in candidates" :key="x.installationId" class="gh2-account-option" :class="{ chosen: draft.installationId === x.installationId }">
                <div class="account-icon"><GhIcon :name="x.accountType === 'Organization' ? 'building' : 'user'" /></div>
                <div class="grow">
                  <strong>{{ x.accountLogin }}</strong>
                  <p>{{ candidateSubtitle(x) }}</p>
                  <span v-if="existingConnectionFor(x.installationId, draft.scope)" class="pill green">이 공간에 연결됨</span>
                </div>
                <button v-if="existingConnectionFor(x.installationId, draft.scope)" type="button" class="button" @click="editCandidateConnection(x)">연결 관리</button>
                <input v-else type="radio" name="gh2-account" :value="x.installationId" :checked="draft.installationId === x.installationId" :disabled="!candidateShareable(x)" :aria-label="`${x.accountLogin} 선택`" @change="pickCandidate(x)" />
              </div>
            </div>
            <div v-else class="repo-empty"><GhIcon name="github" /><strong>연결 가능한 설치가 없어요</strong><p>아래에서 GitHub에 Error Archive를 설치하세요.</p></div>
            <div class="gh2-new-account"><button type="button" class="text-button" @click="installNewAccount"><GhIcon name="plus" />다른 GitHub 계정에 설치</button><span>원하는 계정이 목록에 없나요?</span></div>
            <p class="scope-hint"><GhIcon name="shield" />공간 관리 권한과 저장소 공유 권한을 함께 확인합니다.</p>
          </div>
          <div class="modal-actions"><button type="button" class="button ghost" @click="startConnect">이전</button><button type="button" class="button primary" :disabled="!draft.installationId" @click="toRepos">저장소 선택 <GhIcon name="arrow" /></button></div>
        </template>

        <!-- 저장소 선택 -->
        <template v-else-if="view === 'repos'">
          <div class="modal-top"><div class="row"><GhIcon name="github" /><strong>{{ draft.connectionId ? '이 공간의 저장소 변경' : '사용할 저장소 선택' }}</strong></div><button type="button" class="icon-button" aria-label="닫기" @click="closeDialog"><GhIcon name="close" /></button></div>
          <div class="modal-inner">
            <div v-if="!draft.connectionId" class="steps gh2-steps"><span v-for="(s, k) in steps" :key="s"><GhIcon v-if="k" name="chevron" /><span :class="{ current: k === 2 }"><span class="step-num">{{ k < 2 ? '✓' : k + 1 }}</span>{{ s }}</span></span></div>
            <h2 id="gh-dialog-title" tabindex="-1">{{ draftScopeLabel }}에서 사용할 저장소</h2>
            <p class="modal-intro">{{ dialogInstallLabel }}에서 GitHub가 접근을 허용한 저장소 중 선택하세요.</p>
            <div v-if="!draft.connectionId" class="gh2-context"><span class="row"><GhIcon :name="draft.scope === 'personal' ? 'user' : 'users'" /><strong>{{ draftScopeLabel }}</strong></span><span class="pill">{{ draft.scope === 'personal' ? 'Personal' : 'Workspace' }}</span></div>
            <div class="gh2-select-head"><span>선택 <strong>{{ draft.selected.length }}</strong> / {{ draft.available.length }}</span><button type="button" class="text-button" @click="selectAll">전체 선택</button></div>
            <div v-if="draft.available.length" class="gh2-pick-list">
              <label v-for="r in draft.available" :key="r.repoId" class="gh2-pick-row">
                <GhIcon name="repo" />
                <span class="grow"><strong><span class="repo-owner">{{ dialogInstallLabel }} / </span>{{ repoName(r.fullName) }}</strong><span class="pill"><GhIcon v-if="r.isPrivate" name="lock" />{{ r.isPrivate ? 'Private' : 'Public' }}</span></span>
                <input type="checkbox" :checked="draft.selected.includes(r.repoId)" :disabled="!r.selectable" :aria-label="`${repoName(r.fullName)} 선택`" @change="toggleRepo(r.repoId, ($event.target as HTMLInputElement).checked)" />
              </label>
            </div>
            <div v-else class="repo-empty"><GhIcon name="repo" />GitHub에서 허용한 저장소가 없어요.<p>설치 설정에서 저장소 접근을 허용한 뒤 선택해 주세요.</p></div>
            <div class="notice gh2-share-note" :class="draft.scope === 'personal' ? '' : 'amber'">
              <GhIcon :name="draft.scope === 'personal' ? 'lock' : 'users'" />
              <div v-if="draft.scope === 'personal'">선택한 저장소는 개인 공간에서 사용합니다.</div>
              <div v-else>선택한 저장소의 Issue·PR·CI 정보가 <strong>{{ draftScopeLabel }}의 현재 멤버</strong>에게 공유됩니다. 비공개 저장소도 포함됩니다.</div>
            </div>
            <p class="scope-hint"><GhIcon name="info" />여기서 바꾸는 선택은 이 공간에만 적용됩니다. GitHub에서 새 저장소 접근을 허용해도 이 공간에 자동 추가되지 않아요.</p>
            <p v-if="removedOnEdit" class="gh2-change-note">제외한 저장소 {{ removedOnEdit }}개의 새 동기화와 근거 추가가 중단됩니다.</p>
          </div>
          <div class="modal-actions">
            <button type="button" class="button ghost" @click="draft.connectionId ? closeDialog() : openDialog('accounts')">{{ draft.connectionId ? '취소' : '이전' }}</button>
            <button type="button" class="button primary" :disabled="!draft.selected.length && !draft.connectionId" @click="confirmStep">선택 확인 <GhIcon name="arrow" /></button>
          </div>
        </template>

        <!-- 연결 확인 -->
        <template v-else-if="view === 'confirm'">
          <div class="modal-top"><div class="row"><GhIcon name="github" /><strong>연결 확인</strong></div><button type="button" class="icon-button" aria-label="닫기" @click="closeDialog"><GhIcon name="close" /></button></div>
          <div class="modal-inner">
            <div v-if="!draft.connectionId" class="steps gh2-steps"><span v-for="(s, k) in steps" :key="s"><GhIcon v-if="k" name="chevron" /><span :class="{ current: k === 3 }"><span class="step-num">{{ k < 3 ? '✓' : k + 1 }}</span>{{ s }}</span></span></div>
            <h2 id="gh-dialog-title" tabindex="-1">{{ draft.connectionId ? '저장소 선택을 변경할까요?' : '이 공간에 연결할까요?' }}</h2>
            <p class="modal-intro">아래 공간과 저장소를 확인해 주세요.</p>
            <dl class="success-detail"><dt>GitHub 계정</dt><dd>{{ dialogInstallLabel }}</dd><dt>연결 공간</dt><dd>{{ draftScopeLabel }}</dd><dt>선택한 저장소</dt><dd>{{ draft.selected.length }}개</dd></dl>
            <div class="gh2-confirm-repos">
              <template v-if="draft.selected.length">
                <span v-for="r in confirmSelectedRepos" :key="r.repoId"><GhIcon name="repo" />{{ repoName(r.fullName) }}<span v-if="r.isPrivate" class="pill">Private</span></span>
              </template>
              <span v-else class="muted">선택한 저장소가 없습니다. 이 공간의 동기화가 중단됩니다.</span>
            </div>
            <div class="notice green"><GhIcon name="check" /><div>기존에 다른 공간에 연결한 계정과 저장소 선택은 그대로 유지됩니다.</div></div>
          </div>
          <div class="modal-actions"><button type="button" class="button ghost" @click="openDialog('repos')">이전</button><button type="button" class="button primary" :disabled="saving" @click="save">{{ draft.connectionId ? '변경 사항 저장' : '연결하기' }}</button></div>
        </template>

        <!-- 완료 -->
        <template v-else-if="view === 'success'">
          <div class="modal-top"><div class="row"><GhIcon name="github" /><strong>GitHub 연결 완료</strong></div><button type="button" class="icon-button" aria-label="닫기" @click="closeDialog"><GhIcon name="close" /></button></div>
          <div class="status-view">
            <div class="status-symbol"><GhIcon name="check" /></div>
            <h2 id="gh-dialog-title" tabindex="-1">{{ draft.updated ? '저장소 선택을 변경했어요' : '새 공간에 연결했어요' }}</h2>
            <p>{{ dialogInstallLabel }}의 선택한 저장소를<br />{{ draftScopeLabel }}에서 사용할 수 있어요.</p>
            <dl class="success-detail"><dt>GitHub 계정</dt><dd>{{ dialogInstallLabel }}</dd><dt>연결 공간</dt><dd>{{ draftScopeLabel }}</dd><dt>이 공간의 저장소</dt><dd>{{ draft.selected.length }}개</dd></dl>
            <div class="notice green gh2-success-note"><GhIcon name="check" />다른 공간의 연결은 유지됩니다.</div>
          </div>
          <div class="modal-actions"><span class="small muted">저장소 선택은 이 화면에서 변경할 수 있어요.</span><button type="button" class="button primary" @click="finishSuccess">연결 확인 <GhIcon name="arrow" /></button></div>
        </template>

        <!-- 해제 -->
        <template v-else-if="view === 'disconnect'">
          <div class="modal-top"><div class="row"><GhIcon name="github" /><strong>공간 연결 해제</strong></div><button type="button" class="icon-button" aria-label="닫기" @click="closeDialog"><GhIcon name="close" /></button></div>
          <div class="modal-inner">
            <h2 id="gh-dialog-title" tabindex="-1">{{ draftScopeLabel }}에서 연결을 해제할까요?</h2>
            <p class="modal-intro">{{ dialogInstallLabel }}과 이 공간의 연결만 해제합니다.</p>
            <div class="gh2-impact">
              <div><GhIcon name="pause" />이 공간의 새 근거 추가와 자동 동기화가 중단됩니다.</div>
              <div><GhIcon name="lock" />비공개 GitHub 상세 정보는 더 이상 표시하지 않습니다.</div>
              <div><GhIcon name="check" />작성한 Case·Step·댓글과 연결 이력은 유지됩니다.</div>
              <div><GhIcon name="check" />다른 공간의 연결과 GitHub 앱 설치는 유지됩니다.</div>
            </div>
          </div>
          <div class="modal-actions"><button type="button" class="button ghost" @click="closeDialog">취소</button><button type="button" class="button danger" :disabled="saving" @click="confirmDisconnect">이 공간에서 연결 해제</button></div>
        </template>
      </template>
    </dialog>

    <div class="toast gh2-toast" role="status" aria-live="polite" :hidden="!toastMsg"><GhIcon name="check" /><span>{{ toastMsg }}</span></div>
  </div>
</template>
