import type { RefInfo } from './githubRefs'

// 본문 GitHub 참조 조회 결과 — Case 화면을 나갔다 다시 와도 곧바로 제목을 보여 주도록 잠시 기억한다.
// 같은 참조라도 Case 마다 보이는지가 달라(공간·비공개 권한) 사용자 + Case 단위로 나눈다. 성공한 결과만 담는다.
const TTL_MS = 10 * 60 * 1000
const store = new Map<string, { info: RefInfo; at: number }>()

const slot = (userId: number, caseId: number, key: string) => `${userId}:${caseId}:${key.toLowerCase()}`

export function getCachedRef(userId: number | null, caseId: number | null, key: string): RefInfo | null {
  if (userId == null || caseId == null) return null
  const k = slot(userId, caseId, key)
  const hit = store.get(k)
  if (!hit) return null
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(k)
    return null
  }
  return hit.info
}

export function putCachedRef(userId: number | null, caseId: number | null, key: string, info: RefInfo) {
  if (userId == null || caseId == null) return
  store.set(slot(userId, caseId, key), { info, at: Date.now() })
}

/** 로그아웃·계정 전환 시 */
export function clearRefCache() {
  store.clear()
}
