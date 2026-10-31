import { computed, inject, onScopeDispose, provide, reactive, ref, unref, watch, type InjectionKey, type MaybeRef } from 'vue'
import { isAxiosError } from 'axios'
import { githubReferenceApi } from '@/services/githubReferenceApi'
import type { GithubReferenceSearchItem } from '@/types/githubReference'
import type { GithubRefKind } from '@/types/githubEvidence'
import { refUrl, type RefInfo, type RefState } from '@/utils/githubRefs'
import { getCachedRef, putCachedRef } from '@/utils/githubRefCache'
import { useAuthStore } from '@/stores/authStore'
import type { CaseGithub } from './useCaseGithub'

// 본문 GitHub 참조 — 읽기 화면 링크의 제목·상태(Case 기준 조회)와 클릭 미리보기(목업 openGithubPreview) 한곳.
// 참조는 글 속 인용일 뿐 Case 근거가 아니다. 근거 연결은 미리보기의 "Case 근거로 연결하기"로 사람이 한다.

/** 목업 previewRefData / refFixture 의 모양 */
export interface RefPreview {
  repo: string
  number: number
  kind: GithubRefKind | 'UNKNOWN'
  title: string
  status: string
  url: string
}

const norm = (key: string) => key.toLowerCase()

const LOADING: RefState = { status: 'loading' }
/** 네트워크·서버 오류일 때만 다시 조회 — 1초, 3초 뒤 두 번까지 */
const RETRY_DELAYS = [1000, 3000]

export function createGithubRefs(opts: {
  /** 읽기 화면 조회 기준 Case. 생성 화면처럼 아직 없으면 null — 자동완성에서 고른 것만 제목을 안다 */
  caseId: MaybeRef<number | null>
  /** `#` 자동완성이 뒤지는 공간(Case 가 속한·속할 곳). null = 개인 */
  workspaceId: MaybeRef<number | null>
  /** Case 상세의 근거 — 미리보기의 "연결된 근거 보기"·"Case 근거로 연결하기" */
  evidence?: CaseGithub | null
}) {
  const auth = useAuthStore()
  const states = reactive(new Map<string, RefState>())
  const preview = ref<RefPreview | null>(null)
  const attempts = new Map<string, number>()
  let pending = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let disposed = false
  onScopeDispose(() => { disposed = true })

  function lookup(key: string): RefState {
    return states.get(norm(key)) ?? LOADING
  }

  function settle(key: string, info: RefInfo) {
    states.set(norm(key), { status: 'resolved', data: info })
    putCachedRef(auth.userId, unref(opts.caseId), key, info)
  }

  /** 이 Case 의 (보이는) 근거로 이미 가져온 Issue·PR 이면 다시 묻지 않는다. */
  function fromEvidence(key: string): RefInfo | null {
    const i = key.lastIndexOf('#')
    const repo = key.slice(0, i).toLowerCase()
    const number = Number(key.slice(i + 1))
    const x = opts.evidence?.items.value.find(x => !x.masked && x.number === number && x.repo.toLowerCase() === repo)
    return x && x.title ? { kind: x.kind, title: x.title, status: x.status, url: x.url || refUrl(x.repo, number, x.kind) } : null
  }

  const known = (key: string) => fromEvidence(key) ?? getCachedRef(auth.userId, unref(opts.caseId), key)

  function schedule() {
    if (pending.size && !timer) timer = setTimeout(flush, 0)
  }

  /** 렌더된 본문의 참조 키들 — 근거·최근 조회로 아는 것은 바로 채우고, 모르는 것만 한 번에 모아 조회한다. */
  function request(keys: string[]) {
    keys.forEach(k => {
      if (states.has(norm(k))) return
      const info = known(k)
      if (info) {
        settle(k, info)
        return
      }
      states.set(norm(k), LOADING)
      pending.add(k)
    })
    schedule()
  }

  // 근거 목록이 본문보다 늦게 오면, 그 사이 조회 중이던 참조를 근거로 먼저 채운다.
  if (opts.evidence) {
    watch(opts.evidence.items, () => {
      states.forEach((s, k) => {
        if (s.status !== 'loading' && s.status !== 'error') return
        const info = fromEvidence(k)
        if (info) settle(k, info)
      })
    })
  }

  function retryLater(key: string) {
    const n = attempts.get(norm(key)) ?? 0
    if (n >= RETRY_DELAYS.length) return
    attempts.set(norm(key), n + 1)
    setTimeout(() => {
      if (disposed || lookup(key).status !== 'error') return
      pending.add(key)
      schedule()
    }, RETRY_DELAYS[n])
  }

  async function flush() {
    timer = null
    const keys = [...pending].filter(k => lookup(k).status !== 'resolved')
    pending = new Set()
    if (!keys.length) return
    const caseId = unref(opts.caseId)
    if (caseId == null) {
      keys.forEach(k => states.set(norm(k), { status: 'unavailable' }))
      return
    }
    try {
      const { data } = await githubReferenceApi.resolve(caseId, keys)
      const byKey = new Map(data.references.map(r => [norm(r.ref), r]))
      keys.forEach(k => {
        const r = byKey.get(norm(k))
        if (r?.resolved && r.kind && r.title && r.status) {
          settle(k, { kind: r.kind, title: r.title, status: r.status, url: r.url ?? refUrl(r.repo, r.number, r.kind) })
        } else if (lookup(k).status !== 'resolved') {
          states.set(norm(k), { status: 'unavailable' })
        }
      })
    } catch (e) {
      // 권한·잘못된 요청(4xx)은 다시 물어도 같다. 네트워크·서버 오류·429 만 다시 조회한다.
      const code = isAxiosError(e) ? e.response?.status : undefined
      const retryable = code == null || code >= 500 || code === 408 || code === 429
      keys.forEach(k => {
        if (lookup(k).status === 'resolved') return
        states.set(norm(k), { status: retryable ? 'error' : 'unavailable' })
        if (retryable) retryLater(k)
      })
    }
  }

  /** 자동완성에서 고른 결과는 바로 제목을 안다(저장 전 미리보기용). */
  function remember(item: GithubReferenceSearchItem) {
    settle(`${item.repo}#${item.number}`, { kind: item.kind, title: item.title, status: item.status, url: refUrl(item.repo, item.number, item.kind) })
  }

  function open(key: string) {
    const i = key.lastIndexOf('#')
    const repo = key.slice(0, i)
    const number = Number(key.slice(i + 1))
    const state = lookup(key)
    preview.value = state.status === 'resolved'
      ? { repo, number, kind: state.data.kind, title: state.data.title, status: state.data.status, url: state.data.url }
      : { repo, number, kind: 'UNKNOWN', title: `Issue / PR #${number} (조회 전)`, status: '확인 필요', url: refUrl(repo, number, 'UNKNOWN') }
  }

  function close() {
    preview.value = null
  }

  /** 미리보기 대상이 이 Case 의 (보이는) 공식 근거인지 */
  function linkedItem(p: RefPreview) {
    return opts.evidence?.items.value.find(x =>
      !x.masked && x.kind === p.kind && x.number === p.number && x.repo.toLowerCase() === p.repo.toLowerCase()) ?? null
  }

  const writes = () => opts.evidence?.writes.value ?? false

  function jumpEvidence(id: number) {
    close()
    opts.evidence?.jumpEvidence(id)
  }

  function source(p: RefPreview) {
    window.open(p.url, '_blank', 'noopener')
  }

  function connect(p: RefPreview) {
    close()
    opts.evidence?.startAdd(p.url)
    opts.evidence?.toast(p.kind === 'ISSUE' ? '본문에서 참조하던 Issue를 Case 근거로 연결해 보세요.' : '본문에서 참조하던 PR을 Case 근거로 연결해 보세요.')
  }

  const workspaceId = computed(() => unref(opts.workspaceId))

  return { workspaceId, lookup, request, remember, open, close, preview, linkedItem, writes, jumpEvidence, source, connect }
}

export type GithubRefs = ReturnType<typeof createGithubRefs>
const KEY: InjectionKey<GithubRefs> = Symbol('githubRefs')

export function provideGithubRefs(opts: Parameters<typeof createGithubRefs>[0]): GithubRefs {
  const r = createGithubRefs(opts)
  provide(KEY, r)
  return r
}

/** GitHub 연동 기능 플래그 — 꺼져 있으면 제공하지 않는다(본문 참조는 일반 텍스트, 자동완성 없음). */
export const githubRefsEnabled = import.meta.env.VITE_GITHUB_INTEGRATION_ENABLED === 'true'

/** 제공자가 없으면(댓글·발행물 등) null — 참조를 링크로 바꾸지 않는다. */
export function useGithubRefs(): GithubRefs | null {
  return inject(KEY, null)
}
