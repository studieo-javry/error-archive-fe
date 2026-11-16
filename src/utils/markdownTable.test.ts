// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { splitCells, isDelimiterRow, alignOf, isTableStart, buildTable } from './markdownTable'

describe('splitCells — 셀 분리', () => {
  it('양끝 파이프 제거 + trim', () => {
    expect(splitCells('| 시각 | 사건 |')).toEqual(['시각', '사건'])
    expect(splitCells('17:03 | 배포')).toEqual(['17:03', '배포'])
  })
  it('이스케이프된 \\| 는 리터럴 파이프로', () => {
    expect(splitCells('| a \\| b | c |')).toEqual(['a | b', 'c'])
  })
})

describe('isDelimiterRow — 구분행 판별', () => {
  it('구분행 참', () => {
    expect(isDelimiterRow('|---|---|')).toBe(true)
    expect(isDelimiterRow('| :-- | --: | :-: |')).toBe(true)
    expect(isDelimiterRow('---')).toBe(true)
  })
  it('일반 파이프 텍스트는 거짓', () => {
    expect(isDelimiterRow('| a | b |')).toBe(false)
    expect(isDelimiterRow('a | b')).toBe(false)
    expect(isDelimiterRow('')).toBe(false)
  })
})

describe('alignOf — 정렬', () => {
  it(':-- left, --: right, :-: center, --- 미지정', () => {
    expect(alignOf(':--')).toBe('left')
    expect(alignOf('--:')).toBe('right')
    expect(alignOf(':-:')).toBe('center')
    expect(alignOf('---')).toBe('')
  })
})

describe('isTableStart — 표 시작 감지', () => {
  it('헤더 + 다음 줄 구분행이면 참', () => {
    expect(isTableStart(['| h |', '|---|', '| v |'], 0)).toBe(true)
  })
  it('구분행이 없으면 거짓(그냥 파이프 텍스트)', () => {
    expect(isTableStart(['a | b', 'c | d'], 0)).toBe(false)
    expect(isTableStart(['| h |'], 0)).toBe(false) // 마지막 줄
  })
})

describe('buildTable — 표 HTML 생성', () => {
  it('thead/tbody/th/td 구조', () => {
    const lines = ['| 시각 | 사건 |', '|---|---|', '| 17:03 | 배포 |', '| 17:05 | 경보 |']
    const { html, end } = buildTable(lines, 0)
    expect(html).toContain('<table>')
    expect(html).toContain('<thead><tr><th>시각</th><th>사건</th></tr></thead>')
    expect(html).toContain('<td>17:03</td><td>배포</td>')
    expect(html).toContain('<td>17:05</td><td>경보</td>')
    expect(end).toBe(3) // 마지막 본문행 인덱스
  })
  it('정렬 스타일이 th/td 에 반영', () => {
    const { html } = buildTable(['| L | R |', '| :-- | --: |', '| a | b |'], 0)
    expect(html).toContain('<th style="text-align:left">L</th>')
    expect(html).toContain('<th style="text-align:right">R</th>')
    expect(html).toContain('<td style="text-align:left">a</td>')
    expect(html).toContain('<td style="text-align:right">b</td>')
  })
  it('본문은 빈 줄/파이프 없는 줄에서 끊긴다', () => {
    const lines = ['| h |', '|---|', '| v |', '', '문단']
    const { html, end } = buildTable(lines, 0)
    expect(html).toContain('<td>v</td>')
    expect(html).not.toContain('문단')
    expect(end).toBe(2)
  })
  it('셀 안 이미 렌더된 HTML(코드/볼드)은 그대로 보존', () => {
    const { html } = buildTable(['| 커밋 | 상태 |', '|---|---|', '| <code>d6f899a</code> | <strong>정상</strong> |'], 0)
    expect(html).toContain('<td><code>d6f899a</code></td>')
    expect(html).toContain('<td><strong>정상</strong></td>')
  })
})
