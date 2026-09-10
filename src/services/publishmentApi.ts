import apiClient from './apiClient'
import type {
  PublishmentDetail,
  PublishmentListResponse,
  PublishmentSort,
  PublishmentVisibility,
} from '@/types/publish'

/**
 * publish-api 발행물 API (게이트웨이 → :8084).
 *
 * 이름이 비슷한 `publishApi` 와는 다른 것이다 — 그쪽은 core-api 의 레거시
 * report/fork/bookmark 다. 발행물(`/publishments`)은 전부 이쪽으로 온다.
 */
export const publishmentApi = {
  /**
   * 내가 발행한 목록 (Library > Published).
   *
   * keyset 커서 페이징 — 첫 페이지는 `cursor` 를 생략하고, 이후 응답의
   * `nextCursor` 를 그대로 넘긴다. `hasNext=false` 면 끝.
   * 워크스페이스 필터는 BE 에 없다 — 응답은 항상 내 전체 발행물이다.
   */
  listMine(params: {
    q?: string
    visibility?: PublishmentVisibility
    sort?: PublishmentSort
    cursor?: string
    limit?: number
  } = {}) {
    return apiClient.get<PublishmentListResponse>('/publishments/me', { params })
  },

  /**
   * 케이스의 발행 상태 (케이스 상세 하단 상태 바용). 소유자 전용 —
   * 발행한 적 없거나 내 것이 아니면 **404**. 호출부에서 404 는 "미발행"으로 처리.
   */
  getByCase(caseId: number) {
    return apiClient.get<PublishmentDetail>(`/publishments/by-case/${caseId}`)
  },

  /** 발행 내리기(soft) — 공개 링크 410, 목록/검색 제외. slug·스냅샷·지표 보존(다시 공개 가능). */
  unpublish(slug: string) {
    return apiClient.post<PublishmentDetail>(`/publishments/by-slug/${slug}/unpublish`)
  },

  /** 다시 공개 (UNPUBLISHED → LIVE). 버전/스냅샷 변화 없음. */
  restore(slug: string) {
    return apiClient.post<PublishmentDetail>(`/publishments/by-slug/${slug}/publish`)
  },
}
