import { computed, inject, provide, reactive, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import axios from 'axios'
import { githubEvidenceApi } from '@/services/githubEvidenceApi'
import { githubIntegrationApi } from '@/services/githubIntegrationApi'
import type {
  CaseGithubEvidence,
  GithubBackfilledPullRequest,
  GithubEvidenceEvent,
  GithubEvidenceItem,
  GithubRef,
  GithubRefKind,
} from '@/types/githubEvidence'
import type { ErrorCaseDetail, Step } from '@/types/error'

// Case 상세의 GitHub 근거(P1-a·b·c) 상태 한곳 — 근거 목록·GitHub 이력·Step/Solution 근거·모달이 같이 쓴다.
// 화면 규칙은 error_archive_github_link_checkbox_aligned.html 목업의 함수(viewItems·evidenceTree·timeline …)를 그대로 따른다.

/** 목업 viewItems() 의 한 줄. 가려진 근거는 kind·status·stepIds 만 쓴다. */
export interface GhViewItem {
  /** linkId. 가려진 근거는 linkId 가 없어 음수 임시 키 */
  id: number
  kind: GithubRefKind
  masked: boolean
  status: string
  repo: string
  number: number
  title: string
  author: string
  privacy: boolean
  url: string
  linkedAt: string
  stepIds: number[]
  diff: { files: number; additions: number; deletions: number } | null
  ci: { status: string; passed: number; total: number; failed: string[]; stale: boolean } | null
  /** Issue #N 을 닫는 PR 이라 자동 연결(viaIssue) */
  via?: number
  viaRepo?: string
}

/** 목업 state.events 의 한 줄. */
export interface GhViewEvent {
  id: number
  type: string
  at: string
  when: string
  kind: GithubRefKind
  repo: string
  number: number | null
  masked: boolean
  via?: number
  conclusion?: string
  passed?: number
  total?: number
}

export type GhTimelineEntry =
  | { type: 'step'; at: string; step: Step }
  | { type: 'event'; at: string; event: GhViewEvent }
  | { type: 'activity'; at: string; events: GhViewEvent[]; key: string }
  | { type: 'more'; at: string }

export type GhFilter = 'all' | 'steps' | 'github'

export type GhModal =
  | { type: 'add'; url?: string }
  | { type: 'detach'; id: number }
  | { type: 'tag'; stepId: number }
  | { type: 'backfill'; issueId: number; issueNumber: number; linked: GithubBackfilledPullRequest[]; skipped: GithubRef[] }

interface Viewer {
  caseRef: Ref<ErrorCaseDetail | null>
  steps: Ref<Step[]>
  isOwner: ComputedRef<boolean>
  canWriteContent: ComputedRef<boolean>
  /** 워크스페이스 Case 의 현재 역할(멤버 아니면 null) */
  workspaceRole: ComputedRef<string | null>
}

const pad = (n: number) => String(n).padStart(2, '0')
/** 목업 linkedAt "2026. 10. 24. 09:00" */
export function formatLinkedAt(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
/** 목업 event.when "10.22 11:40" */
export function formatWhen(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const kindName = (x: { kind: GithubRefKind }) => (x.kind === 'ISSUE' ? 'Issue' : 'PR')
export const statusName = (s: string) =>
  ({ OPEN: 'Open', CLOSED: 'Closed', MERGED: 'Merged', FAILED: 'Failed', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' })[s] || s
export const shortRef = (x: { kind: GithubRefKind; number: number | null }) => `${kindName(x)} #${x.number}`

/** 목업 ciLabel(item) */
export function ciLabel(item: GhViewItem): { label: string; cls: string; icon: 'info' | 'clock' | 'check' | 'close' } | null {
  if (item.kind === 'ISSUE') return null
  const c = item.ci
  if (!c) return { label: 'CI 정보 없음', cls: 'none', icon: 'info' }
  if (c.stale) return { label: '새 커밋 CI 대기', cls: 'stale', icon: 'clock' }
  if (c.status === 'WAITING') return { label: 'CI 결과 대기', cls: 'pending', icon: 'clock' }
  if (c.status === 'SUCCESS') return { label: `CI 통과 · ${c.passed}/${c.total}`, cls: '', icon: 'check' }
  if (c.status === 'FAILURE') return { label: `CI 실패 · ${c.passed}/${c.total}`, cls: 'failure', icon: 'close' }
  if (c.status === 'NEUTRAL') return { label: 'CI 결과 없음', cls: 'none', icon: 'info' }
  return { label: 'CI 진행 중', cls: 'pending', icon: 'clock' }
}

/** 목업 parseUrl(url) */
export function parseUrl(url: string): { repo: string; kind: GithubRefKind; number: number } | null {
  const m = (url || '')
    .trim()
    .match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100})\/(issues|pull)\/(\d{1,9})(?:[/?#].*)?$/i)
  return m && Number(m[4]) > 0
    ? { repo: m[1] + '/' + m[2].replace(/\.git$/, ''), kind: m[3].toLowerCase() === 'issues' ? 'ISSUE' : 'PULL_REQUEST', number: Number(m[4]) }
    : null
}

const PAGE = 8

/** 시각순(오래된 것 먼저). Step(`+09:00`)과 GitHub 이벤트(`Z`)는 표기가 달라 문자열 비교로는 실제 순서가 안 맞는다 — 절대 시점으로 비교. */
export const byTime = (a: { at: string }, b: { at: string }) => Date.parse(a.at) - Date.parse(b.at)

function createCaseGithub(caseId: number, viewer: Viewer) {
  const evidence = ref<CaseGithubEvidence | null>(null)
  const failed = ref(false)
  const eventMap = ref(new Map<number, GithubEvidenceEvent>())
  const nextCursor = ref<string | null>(null)
  const hasNext = ref(false)
  const totalCount = ref(0)
  /** 목업 historyMemo.busy·error·generation — 이전 쪽 조회 중 / 실패 문구 / 늦게 온 응답 무시용 세대 */
  const historyBusy = ref(false)
  const historyError = ref('')
  let generation = 0
  const hasInstallation = ref<boolean | null>(null)

  const ui = reactive({
    expanded: new Set<number>(),
    groupExpanded: new Set<string>(),
    collapsed: false,
    activityExpanded: new Set<string>(),
    activityExpandAll: false,
    activityPageSize: PAGE,
    filter: 'all' as GhFilter,
  })
  const modal = ref<GhModal | null>(null)
  const toastText = ref<string | null>(null)
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  // ── 보는 사람 ──
  const workspaceId = computed(() => viewer.caseRef.value?.workspaceId ?? null)
  const isMember = computed(() => workspaceId.value != null && viewer.workspaceRole.value != null)
  /** 비공개 근거 상세를 보는가 — BE GithubCaseAccessPolicy.canSeePrivate 와 같음 */
  const canSeePrivate = computed(() => (workspaceId.value == null ? viewer.isOwner.value : isMember.value))
  /** 근거 쓰기 — BE requireWrite: Case 쓰기 권한 + 워크스페이스 Case 면 현재 멤버 */
  const writes = computed(() => viewer.canWriteContent.value && (workspaceId.value == null || isMember.value))
  const exMember = computed(() => viewer.isOwner.value && workspaceId.value != null && !isMember.value)
  const readOnly = computed(() => isMember.value && !writes.value && viewer.workspaceRole.value === 'READ')

  const scenario = computed<'failure' | 'noapp' | 'normal'>(() => {
    if (failed.value) return 'failure'
    if (evidence.value && writes.value && hasInstallation.value === false && !allRaw.value.length) return 'noapp'
    return 'normal'
  })
  const available = computed(() => scenario.value === 'normal' && evidence.value != null)
  /** 첫 조회가 끝났나(성공·실패 무관) — 그 전엔 근거 영역을 그리지 않는다 */
  const ready = computed(() => evidence.value != null || failed.value)

  // ── 근거 ──
  const allRaw = computed<GithubEvidenceItem[]>(() => {
    const e = evidence.value
    if (!e) return []
    const prs = [...e.issues.flatMap(i => i.pullRequests ?? []), ...e.ungroupedPullRequests]
    return [...e.issues, ...prs]
  })

  const items = computed<GhViewItem[]>(() => {
    if (!available.value) return []
    let maskedKey = 0
    const mapped = allRaw.value.map((x): GhViewItem => {
      const d = x.diff
      return {
        id: x.linkId ?? --maskedKey,
        kind: x.kind,
        masked: x.masked,
        status: x.state,
        repo: x.repo ?? '',
        number: x.number ?? 0,
        title: x.title ?? '',
        author: x.author ?? '',
        privacy: x.isPrivate === true,
        url: x.url ?? '',
        linkedAt: formatLinkedAt(x.linkedAt),
        stepIds: [...x.stepIds],
        diff: d && d.changedFiles != null && d.additions != null && d.deletions != null
          ? { files: d.changedFiles, additions: d.additions, deletions: d.deletions }
          : null,
        ci: x.ci ? { status: x.ci.status, passed: x.ci.passed, total: x.ci.total, failed: x.ci.failed, stale: x.ci.stale } : null,
        via: x.viaIssue?.number,
        viaRepo: x.viaIssue?.repo ?? undefined,
      }
    })
    // 목업 state.items 처럼 연결한 순서. 가려진 근거는 연결 시각이 없어 뒤로.
    const order = new Map(allRaw.value.map((x, i) => [mapped[i], x.linkedAt ? Date.parse(x.linkedAt) : Number.POSITIVE_INFINITY]))
    return [...mapped].sort((a, b) => order.get(a)! - order.get(b)!)
  })

  const maskedCount = computed(() => evidence.value?.maskedCount ?? 0)
  const syncStopped = computed(() => evidence.value?.syncStopped === true)
  const anyStale = computed(() => items.value.some(x => !x.masked && x.ci?.stale))

  // ── GitHub 활동(이력) ──
  const events = computed<GhViewEvent[]>(() => {
    if (!available.value) return []
    return [...eventMap.value.values()].map(e => ({
      id: e.id,
      type: e.type,
      at: e.occurredAt,
      when: formatWhen(e.occurredAt),
      kind: e.kind,
      repo: e.repo ?? '',
      number: e.number,
      masked: e.masked,
      via: e.issue?.number,
      conclusion: typeof e.data?.conclusion === 'string' ? e.data.conclusion : undefined,
      passed: typeof e.data?.passed === 'number' ? e.data.passed : undefined,
      total: typeof e.data?.total === 'number' ? e.data.total : undefined,
    }))
  })

  function mergeEvents(list: GithubEvidenceEvent[]) {
    const m = new Map(eventMap.value)
    for (const e of list) m.set(e.id, e)
    eventMap.value = m
  }

  async function loadInstallations() {
    if (!writes.value || hasInstallation.value != null) return
    try {
      const { data } = await githubIntegrationApi.listInstallations()
      const c = viewer.caseRef.value
      hasInstallation.value = data.some(i =>
        i.status === 'ACTIVE' &&
        (i.workspaceId != null ? i.workspaceId === c?.workspaceId : c?.workspaceId == null && i.installedByUserId === c?.ownerUserId),
      )
    } catch {
      hasInstallation.value = null
    }
  }

  /**
   * 근거 + 활동 첫 쪽을 다시 받는다(목업 historyRefresh). 처음이면 첫 쪽으로 시작(historySeed).
   * 받아 둔 이력과 첫 쪽이 겹치지 않거나 전체 건수가 받아 둔 수보다 적으면 이어지지 않으므로 첫 쪽부터 다시,
   * 아니면 id 로 합치고 이어 받던 커서를 유지한다. 진행 중이던 이전 쪽 응답은 세대가 바뀌어 버려진다.
   */
  async function load() {
    try {
      const { data } = await githubEvidenceApi.get(caseId)
      evidence.value = data
      failed.value = false
      generation++
      historyBusy.value = false
      historyError.value = ''
      const fresh = data.activity
      const reset = eventMap.value.size === 0
      const overlap = fresh.events.some(e => eventMap.value.has(e.id))
      const replaced = reset || (eventMap.value.size > 0 && !overlap) || fresh.totalCount < eventMap.value.size
      if (replaced) {
        eventMap.value = new Map(fresh.events.map(e => [e.id, e]))
        nextCursor.value = fresh.nextCursor
        hasNext.value = fresh.hasNext
      } else {
        mergeEvents(fresh.events)
        if (!eventMap.value.size) {
          nextCursor.value = fresh.nextCursor
          hasNext.value = fresh.hasNext
        }
        // The oldest loaded cursor stays valid as long as both pages form one continuous range.
        if (eventMap.value.size >= fresh.totalCount) hasNext.value = false
      }
      totalCount.value = fresh.totalCount
      void loadInstallations()
    } catch {
      failed.value = true
    }
  }

  /** 이전 쪽 하나(목업 historyOlderPage). 실패하면 받아 둔 이력은 그대로 두고 문구만 남긴다. */
  async function loadOlder(size: number): Promise<boolean> {
    if (!(hasNext.value && nextCursor.value && !historyBusy.value)) return false
    historyBusy.value = true
    historyError.value = ''
    const token = ++generation
    let data
    try {
      data = (await githubEvidenceApi.events(caseId, nextCursor.value, size)).data
    } catch {
      if (token !== generation) return false
      historyBusy.value = false
      historyError.value = '이전 GitHub 이력을 불러오지 못했어요. 기존 기록은 그대로 유지했어요.'
      return false
    }
    if (token !== generation) return false
    mergeEvents(data.events)
    nextCursor.value = data.nextCursor
    hasNext.value = data.hasNext
    totalCount.value = data.totalCount
    historyBusy.value = false
    return true
  }

  // ── 타임라인(목업 timeline()) ──
  function entries(opts: { selection: boolean }): { list: GhTimelineEntry[]; hiddenOlder: number } {
    const evs = available.value ? events.value : []
    const showSteps = ui.filter !== 'github' || opts.selection
    const showEvents = ui.filter !== 'steps' && !opts.selection
    const list: GhTimelineEntry[] = []
    let hiddenOlder = 0
    if (ui.filter === 'github' && showEvents) {
      const sorted = [...evs].sort(byTime)
      const shown = sorted.slice(Math.max(0, sorted.length - ui.activityPageSize))
      hiddenOlder = Math.max(0, totalCount.value - shown.length)
      shown.forEach(e => list.push({ type: 'event', at: e.at, event: e }))
      return { list, hiddenOlder }
    }
    type Row = { at: string; step?: Step; event?: GhViewEvent; more?: true }
    const rows: Row[] = [
      ...(showSteps ? viewer.steps.value.map(x => ({ at: x.createdAt, step: x })) : []),
      ...(showEvents ? evs.map(x => ({ at: x.at, event: x })) : []),
    ].sort(byTime)
    // 아직 안 받은 이전 이력이 있으면, 받은 이력 중 가장 오래된 것 앞에 "더 보기" 경계를 둔다.
    if (showEvents && hasNext.value && evs.length) {
      const first = rows.findIndex(r => r.event)
      rows.splice(first, 0, { at: rows[first].at, more: true })
    }
    // Consecutive background events between human-written steps share one collapsible row.
    for (let i = 0; i < rows.length;) {
      const r = rows[i]
      if (r.step) { list.push({ type: 'step', at: r.at, step: r.step }); i++; continue }
      if (r.more) { list.push({ type: 'more', at: r.at }); i++; continue }
      const batch: GhViewEvent[] = []
      while (i < rows.length && rows[i].event) { batch.push(rows[i].event!); i++ }
      if (batch.length > 1 && ui.filter === 'all') {
        const prevStep = [...list].reverse().find(x => x.type === 'step')
        const prev = prevStep?.type === 'step' ? prevStep.step.id : 'start'
        const next = rows[i]?.step?.id || 'end'
        list.push({ type: 'activity', at: batch[0].at, events: batch, key: `${prev}-${next}` })
      } else batch.forEach(event => list.push({ type: 'event', at: event.at, event }))
    }
    return { list, hiddenOlder }
  }
  const remainingOlder = computed(() => Math.max(0, totalCount.value - eventMap.value.size))

  /** 목업 historyMoreAction — GitHub 이력 탭은 보여줄 수만큼 받은 뒤에 늘린다(실패하면 그대로, 같은 쪽 재시도). */
  async function moreHistory() {
    if (historyBusy.value) return
    if (ui.filter === 'github') {
      const target = ui.activityPageSize + PAGE
      while (eventMap.value.size < target && hasNext.value) {
        const ok = await loadOlder(Math.max(PAGE, target - eventMap.value.size))
        if (!ok) return // Keep the visible count unchanged on failure; retry the same page.
      }
      ui.activityPageSize = target
    } else {
      await loadOlder(PAGE)
    }
  }

  function setFilter(f: GhFilter) {
    ui.filter = f
    if (f === 'github') ui.activityPageSize = PAGE
  }

  // ── 토스트·이동(목업 toast·jump) ──
  function toast(s: string) {
    toastText.value = s
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toastText.value = null), 3800)
  }
  function flashEl(el: Element | null, scroll: boolean) {
    if (!el) return
    if (scroll) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.remove('anchor-flash')
    void (el as HTMLElement).offsetWidth
    el.classList.add('anchor-flash')
  }
  function jump(id: string) {
    requestAnimationFrame(() => flashEl(document.getElementById(id), true))
  }
  function flash(id: string) {
    requestAnimationFrame(() => flashEl(document.getElementById(id), false))
  }
  function jumpStep(stepId: number) {
    ui.filter = 'all'
    requestAnimationFrame(() => flashEl(document.querySelector(`[data-step-id="${stepId}"]`), true))
  }
  function jumpEvidence(id: number) {
    const linked = items.value.find(x => x.id === id)
    if (linked?.via) ui.groupExpanded.add(`${linked.viaRepo || linked.repo}#${linked.via}`)
    ui.collapsed = false
    ui.expanded.add(id)
    jump('evidence-' + id)
  }
  function toggleExpand(id: number) {
    if (ui.expanded.has(id)) ui.expanded.delete(id)
    else ui.expanded.add(id)
  }

  // ── 쓰기 ──
  const stepNo = (id: number) => {
    const i = viewer.steps.value.findIndex(s => s.id === id)
    return i === -1 ? undefined : i + 1
  }

  /** [url] — 본문 참조 미리보기에서 "Case 근거로 연결하기"로 왔을 때 주소를 미리 채운다. */
  function startAdd(url?: string) {
    if (!writes.value) return toast('근거를 변경할 권한이 없습니다.')
    modal.value = { type: 'add', url }
  }

  /** 목업 addEvidence — 실패 문구는 돌려주고, 성공하면 모달을 닫고 안내한다. */
  async function addEvidence(url: string): Promise<string | null> {
    if (!writes.value) return null
    const p = parseUrl(url)
    if (!p) return '지원하지 않는 주소입니다. Issue 또는 PR URL을 확인해 주세요.'
    if (syncStopped.value) return 'GitHub 연결이 중단되어 추가할 수 없어요. Settings → Integrations에서 설치 상태를 확인하세요.'
    let res
    try {
      res = (await githubEvidenceApi.link(caseId, url.trim())).data
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined
      if (status === 400) return '지원하지 않는 주소입니다. Issue 또는 PR URL을 확인해 주세요.'
      if (status === 403) return '이 Case 공간에 연결된 저장소가 아닙니다. Settings → Integrations에서 연결 공간과 저장소를 확인해 주세요.'
      if (status === 404) return 'GitHub에서 Issue·PR을 찾지 못했어요. 주소와 저장소 접근 권한을 확인해 주세요.'
      return 'GitHub에 잠시 연결할 수 없어요. 입력한 주소를 유지했으니 다시 시도해 주세요.'
    }
    await load()
    const back = res.created && res.kind === 'ISSUE' ? res.backfill : { pullRequests: [], skipped: [] }
    const idOf = (repo: string, number: number) =>
      items.value.find(x => x.kind === 'PULL_REQUEST' && x.number === number && x.repo.toLowerCase() === repo.toLowerCase())?.id
    modal.value = null
    ui.collapsed = false
    jump('evidence-' + res.linkId)
    back.pullRequests.forEach(b => {
      const id = idOf(b.repo, b.number)
      if (id != null) flash('evidence-' + id)
    })
    if (back.pullRequests.length || back.skipped.length) {
      const msg = `Issue #${res.number}을 연결했어요.${back.pullRequests.length ? ` 이 Issue를 닫은 ${back.pullRequests.map(b => 'PR #' + b.number).join(', ')}도 함께 연결했어요.` : ''}${back.skipped.length ? ` ${back.skipped.map(n => 'PR #' + n.number).join(', ')}은 전에 ‘관련 없음’으로 뗐기 때문에 다시 붙이지 않았어요.` : ''}`
      if (back.pullRequests.length) {
        modal.value = { type: 'backfill', issueId: res.linkId, issueNumber: res.number, linked: back.pullRequests, skipped: back.skipped }
      } else toast(msg)
    } else {
      toast(res.created ? 'GitHub 근거를 연결했어요. Step의 ‘근거 연결’에서 사용할 수 있습니다.' : '이미 연결된 근거입니다. 중복으로 추가하지 않았어요.')
    }
    return null
  }

  function confirmBackfill(issueId: number) {
    modal.value = null
    ui.collapsed = false
    jump('evidence-' + issueId)
  }

  function confirmDetach(id: number) {
    if (!writes.value) return
    if (!items.value.find(i => i.id === id)) return
    modal.value = { type: 'detach', id }
  }

  async function detach(id: number) {
    if (!writes.value) return
    await githubEvidenceApi.detach(caseId, id)
    ui.expanded.delete(id)
    modal.value = null
    await load()
    toast('Case와 Step에서 연결을 해제했어요. 연결 이력은 남습니다.')
  }

  function openTagStep(stepId: number) {
    if (!writes.value) return
    if (!viewer.steps.value.find(x => x.id === stepId)) return
    modal.value = { type: 'tag', stepId }
  }

  async function saveTag(stepId: number, picked: number[]) {
    if (!writes.value) return
    try {
      await githubEvidenceApi.setStepLinks(caseId, stepId, picked)
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined
      if (status === 400 || status === 404) {
        modal.value = null
        await load()
        return toast(status === 400
          ? '근거 목록이 바뀌었어요. 목록을 다시 확인한 뒤 연결해 주세요.'
          : 'Step을 찾을 수 없어 저장하지 못했어요. 타임라인을 다시 확인해 주세요.')
      }
      throw e
    }
    modal.value = null
    await load()
    requestAnimationFrame(() => flashEl(document.querySelector(`[data-step-id="${stepId}"]`), true))
    toast(`Step ${stepNo(stepId)}의 근거 ${picked.length}개를 저장했어요.`)
  }

  async function retry() {
    await load()
    if (!failed.value) toast('저장된 근거를 다시 불러왔어요. GitHub 재동기화는 아닙니다.')
  }

  return {
    ui, modal, toastText, items, events, totalCount, hasNext, remainingOlder, historyBusy, historyError,
    scenario, available, ready, writes, exMember, readOnly, canSeePrivate, maskedCount, syncStopped, anyStale,
    workspaceId, stepNo,
    load, entries, moreHistory, setFilter, toast, jumpStep, jumpEvidence, toggleExpand,
    startAdd, addEvidence, confirmBackfill, confirmDetach, detach, openTagStep, saveTag, retry,
  }
}

export type CaseGithub = ReturnType<typeof createCaseGithub>
const KEY: InjectionKey<CaseGithub> = Symbol('caseGithub')

export function provideCaseGithub(caseId: number, viewer: Viewer): CaseGithub {
  const g = createCaseGithub(caseId, viewer)
  provide(KEY, g)
  return g
}

export function useCaseGithub(): CaseGithub {
  const g = inject(KEY)
  if (!g) throw new Error('provideCaseGithub() missing')
  return g
}
