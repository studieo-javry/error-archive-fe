/**
 * publish-api (`/api/v1/publishments`) 타입 — 케이스를 불변 스냅샷으로 발행한 자산.
 *
 * core-api 의 에러 케이스와는 별개 서비스다. 발행물은 발행 시점의 스냅샷이라
 * 원본 케이스가 그 뒤에 바뀌거나 삭제돼도 내용이 따라 변하지 않는다 —
 * 그 어긋남을 알려주는 게 `sourceStale` / `sourceState`.
 */

/** 발행 공개 범위. BE 는 PRIVATE 도 카운트하지만 목록 필터는 이 둘만 받는다. */
export type PublishmentVisibility = 'PUBLIC' | 'UNLISTED'

/** 목록 정렬 — published(최신 발행순, default) / views(조회순). */
export type PublishmentSort = 'published' | 'views'

/**
 * `GET /publishments/me` 의 slim 항목 — 본문 스냅샷(content) 제외, 카운트만.
 * 발행물 본문은 공개 페이지(`publicUrl`)나 export 로 본다.
 */
export interface PublishmentListItem {
  slug: string
  title: string
  summary: string | null
  /** 원본 에러 케이스 id — "from #123" 링크용. */
  originalCaseId: number
  /** PUBLIC | UNLISTED | PRIVATE */
  visibility: string
  /** 원본 케이스 라이프사이클 — LIVE | SOURCE_DELETED */
  sourceState: string
  /** 발행물 라이프사이클 — LIVE | UNPUBLISHED */
  status: string
  /** 원본이 발행 이후 수정됨(재발행 권장). null = 판정 불가(core 조회 실패·원본 삭제). */
  sourceStale: boolean | null
  version: number
  viewCount: number
  downloadCount: number
  stepCount: number
  solutionCount: number
  tags: string[]
  publishedAt: string
  updatedAt: string
  publicUrl: string
  /** 주의: 게이트웨이 라우트는 있지만 publish-api 에 핸들러가 아직 없다(404). */
  markdownUrl: string
  pdfUrl: string
}

/** Load More 봉투. `totalCount` 는 첫 페이지에서만 채워지고 이후 null. */
export interface PublishmentListResponse {
  items: PublishmentListItem[]
  nextCursor: string | null
  hasNext: boolean
  totalCount: number | null
}

/**
 * 단건 발행물 — `GET /publishments/by-case/{caseId}`(소유자 전용, 미발행이면 404)와
 * unpublish/restore 응답. 케이스 상세 하단 발행 상태 바가 쓴다.
 * (content/options 등 무거운 스냅샷 필드는 여기서 생략한다.)
 */
export interface PublishmentDetail {
  slug: string
  publicUrl: string
  markdownUrl: string
  pdfUrl: string
  ownerUserId: number
  originalCaseId: number
  title: string
  summary: string | null
  visibility: string
  tags: string[]
  stepCount: number
  solutionCount: number
  version: number
  viewCount: number
  downloadCount: number
  publishedAt: string
  updatedAt: string
  /** LIVE | SOURCE_DELETED */
  sourceState: string
  /** LIVE | UNPUBLISHED */
  status: string
  /** 단건 응답은 항상 null(목록에서만 채워짐). */
  sourceStale: boolean | null
}
