// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { collectRefKeys, linkifyRefs, refToken } from './githubRefs'

const ta = (value: string, caret = value.length) =>
  ({ value, selectionStart: caret, selectionEnd: caret }) as HTMLTextAreaElement

describe('refToken — # 자동완성 토큰', () => {
  it('# · #번호 · #제목 은 토큰', () => {
    expect(refToken(ta('재시도 로직은 #'))).toEqual({ start: 8, end: 9, num: '' })
    expect(refToken(ta('재시도 로직은 #95'))?.num).toBe('95')
    expect(refToken(ta('(#결제'))?.num).toBe('결제')
  })
  it('제목 줄·단어 중간(C#)·인라인 코드·코드 블록 안은 아님', () => {
    expect(refToken(ta('## 제목'))).toBeNull()
    expect(refToken(ta('C#'))).toBeNull()
    expect(refToken(ta('`#95'))).toBeNull()
    expect(refToken(ta('```\n#95'))).toBeNull()
  })
  it('확정된 owner/repo#N 뒤에서는 다시 뜨지 않음', () => {
    expect(refToken(ta('acme/payment-api#95'))).toBeNull()
  })
})

describe('읽기 화면 링크', () => {
  it('owner/repo#N 과 GitHub 주소를 키로 모으고, 짧은 #95 는 참조가 아님', () => {
    expect(collectRefKeys('a acme/payment-api#95, https://github.com/acme/payment-api/pull/61 그리고 #95')).toEqual([
      'acme/payment-api#95', 'acme/payment-api#61',
    ])
  })
  it('제목을 알면 Context 본문 모양(제목 마지막 단어와 #번호 붙임), 모르면 키', () => {
    const html = linkifyRefs('acme/payment-api#95', () => ({ kind: 'PULL_REQUEST', title: 'fix: 결제 재시도 중복 방지', status: 'MERGED', url: '' }))
    expect(html).toContain('class="gh-task-link pr"')
    expect(html).toContain('fix: 결제 재시도 중복 방지'.replace(' 방지', ' 방지 #95'))
    expect(linkifyRefs('acme/payment-api#95', () => 'loading')).toContain('acme/payment-api#95 (대상 조회 전)')
    expect(linkifyRefs('acme/payment-api#95', () => null)).toContain('<span class="gh-task-link-text">acme/payment-api#95</span>')
  })
})
