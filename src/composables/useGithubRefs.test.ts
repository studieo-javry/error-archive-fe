// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { AxiosError, AxiosHeaders } from 'axios'
import { createGithubRefs } from './useGithubRefs'
import { useAuthStore } from '@/stores/authStore'
import { clearRefCache } from '@/utils/githubRefCache'
import { githubReferenceApi } from '@/services/githubReferenceApi'
import type { CaseGithub } from './useCaseGithub'

const mem = new Map<string, string>()
vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) })
vi.mock('@/services/githubReferenceApi', () => ({ githubReferenceApi: { resolve: vi.fn() } }))
const resolve = vi.mocked(githubReferenceApi.resolve)

const pr61 = { ref: 'acme/payment-api#61', repo: 'acme/payment-api', number: 61, resolved: true, masked: false, kind: 'PULL_REQUEST' as const, title: 'fix: 주문 발행 재처리', status: 'MERGED', url: 'https://github.com/acme/payment-api/pull/61' }
const ok = (references: unknown[]) => ({ data: { references } }) as never
const http = (status: number) => new AxiosError('x', 'ERR', undefined, undefined, { status, statusText: '', headers: {}, config: { headers: new AxiosHeaders() }, data: {} })

function make(evidenceItems = ref<unknown[]>([])) {
  const scope = effectScope()
  const refs = scope.run(() => createGithubRefs({ caseId: 7, workspaceId: null, evidence: { items: computed(() => evidenceItems.value) } as unknown as CaseGithub }))!
  return { refs, scope, evidenceItems }
}
const flushAll = async () => { await vi.runOnlyPendingTimersAsync(); await nextTick() }

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  useAuthStore().userId = 1
  clearRefCache()
  resolve.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('본문 참조 조회 상태', () => {
  it('조회 중 → 성공', async () => {
    resolve.mockResolvedValue(ok([pr61]))
    const { refs } = make()
    refs.request(['acme/payment-api#61'])
    expect(refs.lookup('acme/payment-api#61').status).toBe('loading')
    await flushAll()
    expect(refs.lookup('acme/payment-api#61')).toMatchObject({ status: 'resolved', data: { kind: 'PULL_REQUEST', title: 'fix: 주문 발행 재처리' } })
  })

  it('이 Case 근거로 이미 아는 참조는 조회하지 않음 — 근거가 늦게 와도 채움', async () => {
    const evidence = ref<unknown[]>([{ masked: false, kind: 'ISSUE', repo: 'acme/payment-api', number: 42, title: '주문 이벤트 누락', status: 'CLOSED', url: 'u42' }])
    resolve.mockImplementation(() => new Promise(() => {}))
    const { refs, evidenceItems } = make(evidence)
    refs.request(['ACME/payment-api#42', 'acme/payment-api#61'])
    expect(refs.lookup('acme/payment-api#42')).toMatchObject({ status: 'resolved', data: { title: '주문 이벤트 누락' } })
    await flushAll()
    expect(resolve).toHaveBeenCalledWith(7, ['acme/payment-api#61'])
    evidenceItems.value = [...evidenceItems.value, { masked: false, kind: 'PULL_REQUEST', repo: 'acme/payment-api', number: 61, title: 'fix', status: 'OPEN', url: '' }]
    await nextTick()
    expect(refs.lookup('acme/payment-api#61').status).toBe('resolved')
  })

  it('가려진 근거는 재사용하지 않음', async () => {
    resolve.mockResolvedValue(ok([{ ...pr61, ref: 'acme/x#5', repo: 'acme/x', number: 5, resolved: false, masked: true, kind: null, title: null, status: null, url: null }]))
    const { refs } = make(ref([{ masked: true, kind: 'PULL_REQUEST', repo: '', number: 0, title: '', status: 'OPEN', url: '' }]))
    refs.request(['acme/x#5'])
    await flushAll()
    expect(refs.lookup('acme/x#5').status).toBe('unavailable')
  })

  it('화면을 나갔다 와도(새 인스턴스) 같은 사용자·Case 는 캐시로 바로 — 다른 사용자는 다시 조회', async () => {
    resolve.mockResolvedValue(ok([pr61]))
    const a = make(); a.refs.request(['acme/payment-api#61']); await flushAll(); a.scope.stop()
    const b = make(); b.refs.request(['acme/payment-api#61'])
    expect(b.refs.lookup('acme/payment-api#61').status).toBe('resolved')
    expect(resolve).toHaveBeenCalledTimes(1)
    useAuthStore().userId = 2
    const c = make(); c.refs.request(['acme/payment-api#61'])
    expect(c.refs.lookup('acme/payment-api#61').status).toBe('loading')
  })

  it('캐시는 10분 뒤 만료, 로그아웃 시 비움', async () => {
    resolve.mockResolvedValue(ok([pr61]))
    const a = make(); a.refs.request(['acme/payment-api#61']); await flushAll()
    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    expect(make().refs.lookup('acme/payment-api#61').status).toBe('loading')
    const b = make(); b.refs.request(['acme/payment-api#61']); await flushAll()
    useAuthStore().logout(); useAuthStore().userId = 1
    const c = make(); c.refs.request(['acme/payment-api#61'])
    expect(c.refs.lookup('acme/payment-api#61').status).toBe('loading')
  })

  it('서버·네트워크 오류는 error 로 두고 1초·3초 뒤 두 번까지 다시 조회', async () => {
    resolve.mockRejectedValueOnce(http(503)).mockRejectedValueOnce(new AxiosError('Network Error')).mockResolvedValueOnce(ok([pr61]))
    const { refs } = make()
    refs.request(['acme/payment-api#61'])
    await flushAll()
    expect(refs.lookup('acme/payment-api#61').status).toBe('error')
    await vi.advanceTimersByTimeAsync(1000); await flushAll()
    expect(refs.lookup('acme/payment-api#61').status).toBe('error')
    await vi.advanceTimersByTimeAsync(3000); await flushAll()
    expect(refs.lookup('acme/payment-api#61').status).toBe('resolved')
    expect(resolve).toHaveBeenCalledTimes(3)
  })

  it('재시도는 두 번까지 — 그 뒤엔 error 로 남음', async () => {
    resolve.mockRejectedValue(http(500))
    const { refs } = make()
    refs.request(['acme/payment-api#61'])
    for (let i = 0; i < 5; i++) { await vi.advanceTimersByTimeAsync(5000); await flushAll() }
    expect(resolve).toHaveBeenCalledTimes(3)
    expect(refs.lookup('acme/payment-api#61').status).toBe('error')
  })

  it('권한 오류(4xx)는 다시 묻지 않고 unavailable', async () => {
    resolve.mockRejectedValue(http(403))
    const { refs } = make()
    refs.request(['acme/payment-api#61'])
    await flushAll(); await vi.advanceTimersByTimeAsync(5000)
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(refs.lookup('acme/payment-api#61').status).toBe('unavailable')
  })
})
