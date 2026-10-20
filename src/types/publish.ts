/**
 * publish-api (`/api/v1/publishments`) 타입 — 케이스를 불변 스냅샷으로 발행한 자산.
 *
 * core-api 의 에러 케이스와는 별개 서비스다. 발행물은 발행 시점의 스냅샷이라
 * 원본 케이스가 그 뒤에 바뀌거나 삭제돼도 내용이 따라 변하지 않는다 —
 * 그 어긋남을 알려주는 게 `sourceStale` / `sourceState`.
 */

/** 발행 공개 범위. BE 는 PRIVATE 도 카운트하지만 목록 필터는 이 둘만 받는다. */
export type PublishmentVisibility = 'PUBLIC' | 'UNLISTED'

/** step 시간 표기 방식 — 정확한 타임스탬프 / 상대(Day N) / 숨김. */
export type PublishTimeStyle = 'EXACT' | 'RELATIVE' | 'NONE'

/** 발행 렌더 옵션. 미지정 필드는 BE 기본값(showStepDuration=true, timeStyle=RELATIVE). */
export interface PublishOptions {
  showStepDuration?: boolean
  timeStyle?: PublishTimeStyle
  /** 작성자 표시 이름. 비우면(null) 익명. */
  authorDisplayName?: string | null
}

/**
 * `POST /publishments` 요청 본문. `Idempotency-Key` 헤더(UUID)와 함께 보낸다.
 * includeStepIds 가 null 이면 전체 step 포함 — UI 는 항상 선별 결과를 명시적으로 넣는다.
 */
export interface PublishRequest {
  caseId: number
  title?: string
  summary?: string
  visibility?: PublishmentVisibility
  includeStepIds?: number[]
  includeSolutionIds?: number[]
  /** 발행에서 제외할 첨부 markerId. BE 는 선별된 step 이 참조한 첨부 중 이 목록을 뺀다. */
  excludedAttachmentMarkerIds?: string[]
  options?: PublishOptions
}

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
  /** 저자 요약이 없을 때의 본문 미리보기(스냅샷 description 파생). 둘 다 없으면 null. */
  descriptionPreview: string | null
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
  /** Markdown 내보내기 — 도입 예정. 현재 BE 가 항상 null(핸들러 비활성). 출시 시 export.md URL. */
  markdownUrl: string | null
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
  /** Markdown 내보내기 — 도입 예정. 현재 BE 가 항상 null(핸들러 비활성). 출시 시 export.md URL. */
  markdownUrl: string | null
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

/**
 * `GET /publishments/public` 의 Explore 카드 항목 — 누구나 볼 수 있는 PUBLIC+LIVE 발행물.
 * 소유자 전용 필드(sourceStale/downloadCount 등) 없음. 카드 → 공개 페이지(`publicUrl`).
 */
/** `GET /publishments/public` 봉투 — keyset 커서 페이징. `hasNext=false` 면 끝. */
export interface PublicPublishmentListResponse {
  items: PublicPublishmentItem[]
  nextCursor: string | null
  hasNext: boolean
}

export interface PublicPublishmentItem {
  slug: string
  title: string
  summary: string | null
  descriptionPreview: string | null
  /** 작성자 표시 이름(없으면 null → 익명). */
  author: string | null
  tags: string[]
  stepCount: number
  solutionCount: number
  viewCount: number
  publishedAt: string
  publicUrl: string
}
