// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, ref } from 'vue'
import { createCaseGithub } from './useCaseGithub'
import { githubEvidenceApi } from '@/services/githubEvidenceApi'
import type { CaseGithubEvidence, GithubCi, GithubEvidenceEvent, GithubEvidenceItem } from '@/types/githubEvidence'
import type { ErrorCaseDetail } from '@/types/error'

vi.mock('@/services/githubEvidenceApi', () => ({ githubEvidenceApi: { get: vi.fn(), events: vi.fn() } }))
vi.mock('@/services/githubIntegrationApi', () => ({ githubIntegrationApi: { listInstallations: vi.fn().mockResolvedValue({ data: [] }) } }))
const get = vi.mocked(githubEvidenceApi.get)
const events = vi.mocked(githubEvidenceApi.events)

const ci = (status: GithubCi['status'], passed = 0): GithubCi => ({ status, passed, total: 2, failed: [], url: '', stale: false, source: 'HEAD', sha: 'sha-48' })
const pr = (c: GithubCi | null, state = 'OPEN'): GithubEvidenceItem => ({
  linkId: 1, kind: 'PULL_REQUEST', masked: false, state, repo: 'acme/payment-api', number: 48, isPrivate: false, title: 'fix', url: '',
  author: 'jin', linkSource: 'MANUAL', linkedAt: '2026-10-20T01:00:00Z', isDraft: false, viaIssue: null, closesIssues: [], diff: null, ci: c,
  stepIds: [], pullRequests: null,
})
const ev = (id: number, at: string): GithubEvidenceEvent => ({ id, type: 'PR_OPENED', occurredAt: at, kind: 'PULL_REQUEST', repo: 'acme/payment-api', number: 48, masked: false, issue: null, data: {} })
const body = (item: GithubEvidenceItem, list: GithubEvidenceEvent[], o: { revision: number; totalCount?: number; hasNext?: boolean }): CaseGithubEvidence => ({
  syncStopped: false, issues: [], ungroupedPullRequests: [item], maskedCount: 0,
  activity: { events: list, nextCursor: o.hasNext ? 'c1' : null, hasNext: o.hasNext ?? false, totalCount: o.totalCount ?? list.length, revision: o.revision },
})
const ok = (data: unknown) => ({ data }) as never

let hidden = false
const win = new EventTarget()
const doc = Object.defineProperty(new EventTarget(), 'hidden', { get: () => hidden })
vi.stubGlobal('window', win)
vi.stubGlobal('document', doc)
function make() {
  const scope = effectScope()
  const viewer = {
    caseRef: ref({ workspaceId: null, ownerUserId: 1 } as unknown as ErrorCaseDetail),
    steps: ref([]),
    isOwner: computed(() => true),
    canWriteContent: computed(() => false),
    workspaceRole: computed(() => null),
  }
  const g = scope.run(() => createCaseGithub(7, viewer))!
  return { g, stop: () => { g.dispose(); scope.stop() } }
}
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); await nextTick() }
const tick = async (ms: number) => { await vi.advanceTimersByTimeAsync(ms); await flush() }
const ciOf = (g: ReturnType<typeof make>['g']) => g.items.value[0].ci?.status ?? null

beforeEach(() => {
  vi.useFakeTimers()
  get.mockReset()
  events.mockReset()
  hidden = false
})
afterEach(() => vi.useRealTimers())

describe('GitHub 근거 자동 새로고침', () => {
  it('CI 진행 중이면 30초마다 다시 받고, 결과가 들어오면 멈춤', async () => {
    get.mockResolvedValueOnce(ok(body(pr(ci('PENDING')), [], { revision: 1 })))
    const { g, stop } = make()
    await g.load()
    await flush()
    expect(ciOf(g)).toBe('PENDING')

    get.mockResolvedValueOnce(ok(body(pr(ci('SUCCESS', 2)), [ev(10, '2026-10-20T02:00:00Z')], { revision: 2 })))
    await tick(29_000)
    expect(get).toHaveBeenCalledTimes(1)
    await tick(1_000)
    expect(get).toHaveBeenCalledTimes(2)
    expect(ciOf(g)).toBe('SUCCESS')
    expect(g.events.value.map(e => e.id)).toEqual([10])

    await tick(120_000)
    expect(get).toHaveBeenCalledTimes(2)
    stop()
  })

  it('탭이 가려지면 멈추고, 돌아오면 바로 한 번 받은 뒤 다시 이어감', async () => {
    get.mockResolvedValue(ok(body(pr(ci('PENDING')), [], { revision: 1 })))
    const { g, stop } = make()
    await g.load()
    await flush()

    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    await tick(90_000)
    expect(get).toHaveBeenCalledTimes(1)

    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
    await flush()
    expect(get).toHaveBeenCalledTimes(2)
    await tick(30_000)
    expect(get).toHaveBeenCalledTimes(3)
    stop()
  })

  it('기다리는 PR 이 없으면 주기 조회를 하지 않음', async () => {
    get.mockResolvedValue(ok(body(pr(ci('SUCCESS', 2)), [], { revision: 1 })))
    const { g, stop } = make()
    await g.load()
    await tick(120_000)
    expect(get).toHaveBeenCalledTimes(1)
    stop()
  })

  it('바뀐 것 없이 10분이 지나면 멈춤 — PR 단계 CI 가 없어 "CI 정보 없음"이 계속되는 열린 PR', async () => {
    get.mockResolvedValue(ok(body(pr(null), [], { revision: 1 })))
    const { g, stop } = make()
    await g.load()
    await tick(30_000 * 25)
    expect(get).toHaveBeenCalledTimes(1 + 20)
    stop()
  })

  it('자동 새로고침은 펼쳐 둔 이전 이력을 지우지 않음 — 리비전이 바뀌어도 이어지면 합침', async () => {
    const page1 = [ev(5, '2026-10-20T05:00:00Z'), ev(4, '2026-10-20T04:00:00Z')]
    get.mockResolvedValueOnce(ok(body(pr(ci('PENDING')), page1, { revision: 1, totalCount: 4, hasNext: true })))
    const { g, stop } = make()
    await g.load()
    events.mockResolvedValueOnce(ok({ events: [ev(3, '2026-10-20T03:00:00Z'), ev(2, '2026-10-20T02:00:00Z')], nextCursor: null, hasNext: false, totalCount: 4, revision: 1 }))
    await g.moreHistory()
    expect(g.events.value).toHaveLength(4)

    get.mockResolvedValueOnce(ok(body(pr(ci('SUCCESS', 2)), [ev(6, '2026-10-20T06:00:00Z'), ...page1], { revision: 2, totalCount: 5 })))
    await tick(30_000)
    expect(g.events.value.map(e => e.id).sort()).toEqual([2, 3, 4, 5, 6])
    expect(g.hasNext.value).toBe(false)
    stop()
  })
})
