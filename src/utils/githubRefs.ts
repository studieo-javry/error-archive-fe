// 본문 GitHub 참조 — error_archive_github_hash_search_comparison.html 목업의 refToken · renderReferenceText ·
// previewRefLink 규칙을 그대로 옮김.
import type { GithubRefKind } from '@/types/githubEvidence'

/** 읽기 화면에서 링크로 바꾸는 모양 — GitHub 주소 또는 `owner/repo#N`. (목업 renderReferenceText 의 pattern) */
export const REF_PATTERN = /(https:\/\/github\.com\/([a-z\d-]+\/[\w.-]+)\/(?:issues|pull)\/([1-9]\d{0,8}))|\b([a-z\d-]+\/[\w.-]+)#([1-9]\d{0,8})\b/gi

export interface RefInfo {
  kind: GithubRefKind
  title: string
  status: string
  url: string
}
/**
 * 참조 하나의 조회 상태.
 * - loading: 아직 조회 중 · unavailable: 조회는 됐지만 제목을 못 가져옴(가림·미연결·없음)
 * - error: 네트워크·서버 오류로 조회 실패 — unavailable 과 달리 잠시 뒤 다시 조회한다
 */
export type RefState =
  | { status: 'loading' }
  | { status: 'resolved'; data: RefInfo }
  | { status: 'unavailable' }
  | { status: 'error' }

/** 본문(코드 블록 제외 — 호출 쪽이 이미 뺀 텍스트)에서 참조 키 `owner/repo#N` 을 순서대로 모은다. */
export function collectRefKeys(text: string): string[] {
  const keys: string[] = []
  for (const m of text.matchAll(REF_PATTERN)) {
    const key = refKey(m)
    if (!keys.includes(key)) keys.push(key)
  }
  return keys
}

function refKey(m: RegExpMatchArray): string {
  const repo = m[1] ? m[2] : m[4]
  const num = Number(m[1] ? m[3] : m[5])
  return `${repo}#${num}`
}

/** 목업 refFixture 의 주소 규칙 — 종류를 모르면 issues 주소. */
export const refUrl = (repo: string, number: number, kind: GithubRefKind | 'UNKNOWN') =>
  `https://github.com/${repo}/${kind === 'PULL_REQUEST' ? 'pull' : 'issues'}/${number}`

// 목업 icon(name,'sm') — issue · pr · github 경로 그대로(GhEvIcon 과 같은 값).
const SVG: Record<'issue' | 'pr' | 'github', string> = {
  issue: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3v.1"/>',
  pr: '<circle cx="6" cy="3" r="2"/><circle cx="6" cy="21" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 5v14M18 17v-8a4 4 0 0 0-4-4h-3m3 0 2-2m-2 2 2 2"/>',
  github: '<path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.62 1.22 3.26.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.54 0-1.22.44-2.22 1.16-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.08 1.15a10.74 10.74 0 0 1 5.61 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.54.23 2.68.11 2.96.72.78 1.16 1.78 1.16 3 0 4.3-2.64 5.25-5.15 5.53.4.35.76 1.03.76 2.08v3.1c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z"/>',
}
const icon = (name: 'issue' | 'pr' | 'github') =>
  `<svg class="svg sm ${name === 'github' ? 'github' : ''}" aria-hidden="true" viewBox="0 0 24 24">${SVG[name]}</svg>`

const esc = (x: string) =>
  x.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/**
 * 이미 HTML 이스케이프된 본문 조각에서 참조를 링크 버튼으로 바꾼다.
 * 제목을 가져온 참조는 Context 본문 디자인(목업 previewRefLink): 종류 아이콘 + "제목 #번호" — 제목 마지막 단어와 #번호가 한 줄에 붙는다.
 * 확인할 수 없는 참조는 목업 renderReferenceText 의 미확인 모양: GitHub 아이콘 + 키.
 * 조회 중·일시 오류는 아직 무엇인지 모르므로 본문에 적힌 그대로 둔다(아이콘이 바뀌어 보이는 깜빡임 방지).
 */
export function linkifyRefs(escapedHtml: string, lookup: (key: string) => RefState): string {
  return escapedHtml.replace(REF_PATTERN, (...args) => {
    const match = args[0] as string
    const key = refKey(args as unknown as RegExpMatchArray)
    const num = Number(key.slice(key.lastIndexOf('#') + 1))
    const state = lookup(key)
    if (state.status === 'loading' || state.status === 'error') return match
    if (state.status === 'resolved') {
      const info = state.data
      const kind = info.kind === 'ISSUE' ? 'issue' : 'pr'
      const words = info.title.split(' ')
      const lastWord = words.pop() ?? ''
      // 마지막 단어와 #번호는 함께 줄바꿈되고 밑줄 하나를 공유한다.
      const linkedLabel = esc(words.join(' ')) + ' ' + esc(lastWord) + ' #' + num
      return `<button type="button" class="gh-task-link ${kind}" data-gh-ref="${esc(key)}" title="클릭하여 GitHub 미리보기" aria-label="${esc(info.title)} #${num} 미리보기">${icon(kind)}<span class="gh-task-link-text">${linkedLabel}</span></button>`
    }
    return `<button type="button" class="gh-task-link " data-gh-ref="${esc(key)}" title="GitHub 참조 미리보기">${icon('github')}<span class="gh-task-link-text">${esc(key)}</span></button>`
  })
}

/**
 * 입력 중 커서 앞의 `#…` 토큰 (목업 refToken, B · Issue / PR 검색).
 * 코드 블록·인라인 코드·Markdown 제목 줄·단어 중간의 #(C# 등)은 제외.
 */
export function refToken(ta: HTMLTextAreaElement): { start: number; end: number; num: string } | null {
  if (ta.selectionStart !== ta.selectionEnd) return null
  const cursor = ta.selectionStart
  const before = ta.value.slice(0, cursor)
  const fenceCount = (before.match(/^\s{0,3}```/gm) || []).length
  if (fenceCount % 2) return null
  const line = before.slice(before.lastIndexOf('\n') + 1)
  if (/^\s{0,3}#{1,6}\s/.test(line)) return null
  if ((line.match(/(?<!\\)`/g) || []).length % 2) return null
  const m = line.match(/(^|[\s(\[{"'])#([\p{L}\p{N}_-]{0,40})$/u)
  if (!m) return null
  return { start: cursor - 1 - m[2].length, end: cursor, num: m[2] }
}
