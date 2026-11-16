// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { collectEmbedMarkers } from './embedMarkers'

const ids = (...t: Array<string | null | undefined>) => [...collectEmbedMarkers(...t)].sort()

describe('collectEmbedMarkers', () => {
  it('@snippet / @attach 마커 id 수집', () => {
    expect(ids('원인은 @snippet(7a7d35e9) 참고. 로그 @attach(ab12cd34).')).toEqual(['7a7d35e9', 'ab12cd34'])
  })

  it('@attach 폭 지정(|400)은 id 만', () => {
    expect(ids('@attach(img001|400)')).toEqual(['img001'])
  })

  it('여러 본문(케이스 + 스텝)의 합집합, 중복 제거', () => {
    const body = '본문 @snippet(aaa)'
    const step1 = '스텝1 @snippet(bbb)'
    const step2 = '스텝2 @snippet(aaa) @attach(ccc)' // aaa 중복
    expect(ids(body, step1, step2)).toEqual(['aaa', 'bbb', 'ccc'])
  })

  it('null/undefined 는 건너뛴다', () => {
    expect(ids(null, undefined, '@snippet(xyz)')).toEqual(['xyz'])
  })

  it('마커 없으면 빈 집합', () => {
    expect(ids('마커 없는 평범한 본문', '')).toEqual([])
  })

  it('연속 호출에도 lastIndex 누수 없이 동일 결과(스테이트풀 regex 가드)', () => {
    const t = '@snippet(dup1) @attach(dup2)'
    expect(ids(t)).toEqual(['dup1', 'dup2'])
    expect(ids(t)).toEqual(['dup1', 'dup2'])
  })
})
