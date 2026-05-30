import type { UserSummary } from './user'

export type ErrorStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
export type Visibility = 'PRIVATE' | 'WORKSPACE' | 'LINK_ONLY' | 'DISCOVERABLE'
export type StepStatus = 'FAILED' | 'IN_PROGRESS' | 'RESOLVED'

export interface Tag {
  id: string
  name: string
  usageCount: number
}

export interface ErrorCase {
  id: string
  title: string
  errorMessage: string
  context: string
  stackTrace?: string
  status: ErrorStatus
  visibility: Visibility
  tags: Tag[]
  authorId: string
  author: UserSummary
  workspaceId?: string
  reactionCount: number
  hasReacted: boolean
  commentCount: number
  stepCount: number
  isWatching: boolean
  createdAt: string
  updatedAt: string
}

export interface ErrorCaseSummary {
  id: string
  title: string
  status: ErrorStatus
  tags: Tag[]
  author: UserSummary
  reactionCount: number
  commentCount: number
  createdAt: string
}

export interface ErrorCaseCreateRequest {
  title: string
  errorMessage: string
  context: string
  stackTrace?: string
  visibility: Visibility
  tags: string[]
  workspaceId?: string
}

export interface ErrorCaseUpdateRequest {
  title?: string
  errorMessage?: string
  context?: string
  stackTrace?: string
  visibility?: Visibility
  tags?: string[]
}

export interface Step {
  id: string
  errorCaseId: string
  content: string
  status: StepStatus
  failureReason?: string
  linkedErrorId?: string
  linkedError?: ErrorCaseSummary
  authorId: string
  author: UserSummary
  commentCount: number
  order: number
  createdAt: string
  updatedAt: string
}

export interface StepCreateRequest {
  content: string
  status: StepStatus
  failureReason?: string
  linkedErrorId?: string
}

export interface StepUpdateRequest {
  content?: string
  status?: StepStatus
  failureReason?: string
  linkedErrorId?: string
}

export interface Solution {
  id: string
  errorCaseId: string
  name: string
  rootCause: string
  selectedStepIds: string[]
  steps: Step[]
  authorId: string
  author: UserSummary
  isBookmarked: boolean
  bookmarkCount: number
  forkCount: number
  createdAt: string
}

export interface SolutionCreateRequest {
  name: string
  rootCause: string
  selectedStepIds: string[]
}

export type SnippetLanguage = 'java' | 'kotlin' | 'sql' | 'yaml' | 'json' | 'bash' | 'javascript' | 'typescript' | 'python' | 'text'

export interface Snippet {
  id: string
  errorCaseId: string
  title?: string
  language: SnippetLanguage
  filePath?: string
  lineRange?: string
  caption?: string
  code: string
  authorId: string
  createdAt: string
  updatedAt: string
}

export interface SnippetCreateRequest {
  title?: string
  language: SnippetLanguage
  filePath?: string
  lineRange?: string
  caption?: string
  code: string
}

export interface SnippetUpdateRequest {
  title?: string
  language?: SnippetLanguage
  filePath?: string
  lineRange?: string
  caption?: string
  code?: string
}

export type AttachmentKind = 'image' | 'json' | 'text' | 'file'

export interface Attachment {
  id: string
  errorCaseId: string
  title?: string
  fileName: string
  mimeType: string
  fileSize: number
  url: string
  caption?: string
  kind: AttachmentKind
  authorId: string
  createdAt: string
  updatedAt: string
}

export interface AttachmentCreateRequest {
  title?: string
  caption?: string
  file: File
}

export interface AttachmentUpdateRequest {
  title?: string
  caption?: string
}
