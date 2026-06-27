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

export interface StepUpdateRequest {
  title?: string | null
  status?: StepStatus | null
  attemptType?: AttemptType | null
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

export interface Comment {
  id: number
  errorCaseId: number
  authorUserId: number
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
