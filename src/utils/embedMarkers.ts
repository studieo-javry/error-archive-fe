// 본문(마크다운)에서 인라인 임베드 마커 id 를 수집 — `@snippet(id)` / `@attach(id)` / `@attach(id|폭)`.
// BodyRenderer·UntaggedAssets 가 쓰는 마커 문법과 동일. 여러 본문(케이스 description + 스텝 본문 등)을
// 한 번에 넘기면 합집합을 돌려준다.

const MARKER = /@(?:snippet|attach)\(([a-zA-Z0-9_-]+)(?:\|\d{2,4})?\)/g

/** 넘긴 텍스트들에서 참조된 마커 id 집합. null/undefined 는 건너뛴다. */
export function collectEmbedMarkers(...texts: Array<string | null | undefined>): Set<string> {
  const ids = new Set<string>()
  for (const t of texts) {
    if (!t) continue
    MARKER.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = MARKER.exec(t)) !== null) ids.add(m[1])
  }
  return ids
}
