export type ErrorCaseStatus = 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type Visibility = 'PUBLIC' | 'WORKSPACE' | 'PRIVATE'
export type StepStatus = 'RESOLVED' | 'IN_PROGRESS' | 'FAILED'
export type AttemptType = 'CODE_CHANGE' | 'CONFIG' | 'DEPENDENCY' | 'ENV' | 'ROLLBACK' | 'INVESTIGATION' | 'OTHER'
export type QuoteSourceKind = 'NONE' | 'CASE_BODY' | 'STEP'
export type SuggestionSourceType = 'SNIPPET' | 'MARKDOWN_CODE'
export type SuggestionStatus = 'PENDING' | 'APPLIED' | 'REJECTED'

// ── ErrorCase ──

export interface ErrorCaseSnapshot {
  exceptionClass: string | null
  exceptionMessage: string | null
  rawStackTrace: string | null
  fingerprint: string | null
  rawPaste: string | null
}

export interface ErrorCaseSnippet {
  markerId: string
  title: string
  language: string
  filePathOrClass: string | null
  lineRange: string | null
  caption: string | null
  code: string
}

export interface ErrorCaseAttachment {
  markerId: string
  fileName: string
  contentType: string
  size: number
  kind: string
  storageUrl: string
  /**
   * presigned inline URL — 브라우저가 `<img src>` / 새 탭 미리보기로 직접 사용.
   * 조회 응답엔 항상 존재. 편집 폼의 방금 업로드(미저장) 첨부엔 아직 없음(optional).
   */
  url?: string
  /** presigned attachment URL — Content-Disposition: attachment 라 클릭 시 다운로드. 조회 응답에만 존재. */
  downloadUrl?: string
  title: string | null
  caption: string | null
}

export interface ErrorCaseDetail {
  id: number
  ownerUserId: number
  title: string
  project: string | null
  status: string
  visibility: string
  description: string | null
  workspaceId: number | null
  severity: number | null
  environment: string | null
  occurredAt: string | null
  createdAt: string
  updatedAt: string
  tags: string[]
  snapshot: ErrorCaseSnapshot | null
  snippets: ErrorCaseSnippet[]
  attachments: ErrorCaseAttachment[]
  /** viewer 본인이 이 케이스를 watch 중인지. 별(Watch) 상태 초기화용. */
  watchedByMe?: boolean
  /** "나도 겪었어요"(me-too) 상태 — 카운트 · 본인 여부 · 누른 사용자 id. */
  meToo?: MeTooResponse
}

/** me-too 토글/조회 응답 — POST/DELETE /error-cases/{id}/me-too 및 detail 의 meToo. */
export interface MeTooResponse {
  count: number
  taggedByMe: boolean
  userIds: number[]
}

export interface ErrorCaseSummary {
  id: number
  ownerUserId: number
  title: string
  project: string | null
  descriptionPreview: string | null
  status: string
  visibility: string
  severity: number | null
  tags: string[]
  workspaceId: number | null
  fingerprint: string | null
  exceptionClass: string | null
  createdAt: string
  occurredAt: string | null
  author?: {
    userId: number
    displayName: string
    avatarUrl: string | null
  }
}

// 유사 에러 추천 — 제목 입력 중 비슷한 기존 사례(워크스페이스/본인 스코프).
export interface SimilarCaseItem {
  id: number
  ownerUserId: number
  title: string
  status: string
  visibility: string
  workspaceId: number | null
  tags: string[]
  descriptionPreview: string | null
  score: number // 0~1
  matchedTerms: string[]
  likelyDuplicate: boolean // 서버 판정: score≥0.85 AND 예외 클래스 동일
}

export interface SimilarCaseListResponse {
  items: SimilarCaseItem[]
}

export interface ErrorCaseCreateRequest {
  title: string
  project?: string | null
  paste: string
  tags?: string[]
  description?: string | null
  snippetMarkerIds?: string[]
  attachmentMarkerIds?: string[]
  workspaceId?: number | null
  severity?: number | null
  environment?: string | null
  occurredAt?: string | null
  visibility?: Visibility
}

export interface ErrorCaseCreateResponse {
  id: number
  title: string
  status: string
  fingerprint: string | null
  snippetMarkerIds: string[]
  attachmentMarkerIds: string[]
  createdAt: string
}

export interface ErrorCaseUpdateRequest {
  title?: string | null
  project?: string | null
  paste?: string | null
  description?: string | null
  severity?: number | null
  environment?: string | null
  snippetMarkerIds?: string[] | null
  attachmentMarkerIds?: string[] | null
  status?: ErrorCaseStatus | null
  visibility?: Visibility | null
  tags?: string[]
}

// ── Step ──

export interface Step {
  id: number
  errorCaseId: number
  authorUserId: number
  orderIndex: number
  title: string
  status: StepStatus
  attemptType: string | null
  body: string | null
  insight: string | null
  createdAt: string
  updatedAt: string
}

export interface StepCreateRequest {
  title: string
  status: StepStatus
  attemptType?: string | null
  body?: string | null
  insight?: string | null
}

/** PATCH /steps/{id} — same wrapper as create: BE returns the step plus case state. */
export interface StepUpdateResponse {
  step: Step
  caseStatus: string
  suggestResolve: boolean
}

export interface StepUpdateRequest {
  title?: string | null
  status?: StepStatus | null
  // free-form on the BE (max 64) — an unknown value is registered in the user's catalogue,
  // so this must not be narrowed to the AttemptType literals
  attemptType?: string | null
  clearAttemptType?: boolean
  body?: string | null
  insight?: string | null
}

export interface StepCreateResponse {
  step: Step
  caseStatus: ErrorCaseStatus
  suggestResolve: boolean
}

// ── Solution ──

export interface Solution {
  id: number
  errorCaseId: number
  authorUserId: number
  title: string
  stepIds: number[]
  createdAt: string
  updatedAt: string
}

export interface SolutionCreateRequest {
  title: string
  stepIds: number[]
}

// ── Comment ──

export interface CommentQuote {
  kind: QuoteSourceKind
  sourceId: number | null
  snapshot: string | null
  truncated: boolean
}

export interface CommentReaction {
  emoji: string
  count: number
  userIds: number[]
  reactedByMe: boolean
}

export interface CommentHelpful {
  count: number
  userIds: number[]
  helpedByMe: boolean
}

export interface DiffLine {
  type: 'del' | 'add'
  oldNo: number | null
  newNo: number | null
  code: string
}

export interface CommentSuggestion {
  id: number
  sourceType: SuggestionSourceType
  sourceId: string
  startLine: number
  endLine: number
  oldCode: string
  newCode: string
  status: SuggestionStatus
  additions: number
  deletions: number
  lines: DiffLine[]
  createdAt: string
  updatedAt: string
}

export interface CommentAuthor {
  userId: number
  handle: string | null
  displayName: string
  avatarUrl: string | null
}

/** 멘션 자동완성 후보 (core-api GET /error-cases/{id}/mention-candidates). */
export interface MentionCandidate {
  userId: number
  displayName: string
  /**
   * core-api MentionCandidateResponse 에 아직 없는 필드 — 항상 undefined 로 온다.
   * BE 가 내려주기 시작하면 @handle 삽입이 살아나고, 그전까지는 displayName 폴백.
   */
  handle?: string | null
  avatarUrl: string | null
  /** 후보 source — in-discussion · owner · workspace-member · search. */
  badge: string | null
}

export interface Comment {
  id: number
  errorCaseId: number
  authorUserId: number
  /** 표시용 작성자 정보. 이름/handle/아바타. authorUserId 는 식별/딥링크용으로만. */
  author: CommentAuthor
  isAuthorOfCase: boolean
  parentCommentId: number | null
  body: string
  quote: CommentQuote | null
  reactions: CommentReaction[]
  helpful: CommentHelpful
  mentions: string[]
  suggestion: CommentSuggestion | null
  editedAt: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  replies: Comment[]
}

export interface CommentCreateRequest {
  body: string
  parentCommentId?: number | null
  quoteSourceKind?: QuoteSourceKind
  quoteSourceId?: number | null
  quoteSnapshot?: string | null
  suggestion?: {
    sourceType: SuggestionSourceType
    sourceId: string
    startLine: number
    endLine: number
    oldCode: string
    newCode: string
  } | null
}

export interface CommentListResponse {
  items: Comment[]
  nextCursor: string | null
  hasNext: boolean
  /** 목록에 등장하는 모든 userId(작성자 + 도움됨/리액션 누른 사람)의 표시 정보 디렉토리. */
  authors: CommentAuthor[]
  quoteSummary: {
    general: number
    caseBody: number
    steps: { sourceId: number; count: number }[]
  }
}

// ── Snippet (independent resource) ──

export interface SnippetCreateRequest {
  title?: string | null
  language: string
  filePathOrClass?: string | null
  lineRange?: string | null
  caption?: string | null
  code: string
}

export interface SnippetCreateResponse {
  markerId: string
  embedToken: string
  title: string | null
  language: string
  caption: string | null
  code?: string
}

export interface SnippetDetail {
  markerId: string
  embedToken: string
  title: string
  language: string
  filePathOrClass: string | null
  lineRange: string | null
  caption: string | null
  code: string
  errorCaseId: number | null
}

export interface SnippetUpdateRequest {
  title?: string | null
  language?: string | null
  filePathOrClass?: string | null
  lineRange?: string | null
  caption?: string | null
  code?: string | null
}

// ── Attachment (independent resource) ──

export interface AttachmentUploadResponse {
  markerId: string
  embedToken: string
  fileName: string
  contentType: string
  size: number
  kind: string
  storageUrl: string
}

/** GET /error-attachments/mine — 케이스에 아직 연결 안 한 내 pending 첨부. */
export interface MyPendingAttachment {
  markerId: string
  embedToken: string
  fileName: string
  contentType: string
  size: number
  kind: string
  title: string | null
  caption: string | null
  previewUrl: string | null
  uploadedAt: string
}

/** GET /error-snippets/mine — 케이스에 아직 연결 안 한 내 pending 스니펫. */
export interface MyPendingSnippet {
  markerId: string
  embedToken: string
  title: string | null
  language: string
  filePathOrClass: string | null
  lineRange: string | null
  caption: string | null
  code: string
  uploadedAt: string
}
