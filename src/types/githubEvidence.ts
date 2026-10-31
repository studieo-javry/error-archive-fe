// core-api Case GitHub 근거(P1-a·b·c) — CaseGithubDtos.kt 와 1:1.

export type GithubRefKind = 'ISSUE' | 'PULL_REQUEST'
export type GithubLinkSource = 'MANUAL' | 'IMPORTED' | 'VIA_ISSUE'

export interface GithubRef {
  repo: string | null
  number: number
}

export interface GithubClosingIssue {
  repo: string | null
  number: number
  /** 그 Issue 도 이 Case 에 붙어 있음 */
  inCase: boolean
}

export interface GithubDiff {
  additions: number | null
  deletions: number | null
  changedFiles: number | null
}

export interface GithubCi {
  status: 'SUCCESS' | 'FAILURE' | 'PENDING'
  passed: number
  total: number
  failed: string[]
  url: string
  /** 최신 CI 가 지금 head 커밋 것이 아님 — 새 커밋의 CI 대기 중 */
  stale: boolean
}

export interface GithubEvidenceItem {
  linkId: number | null
  kind: GithubRefKind
  /** 비공개 레포 근거라 상세를 가림 */
  masked: boolean
  /** Issue: OPEN|CLOSED, PR: OPEN|CLOSED|MERGED */
  state: string
  repo: string | null
  number: number | null
  isPrivate: boolean | null
  title: string | null
  url: string | null
  author: string | null
  linkSource: GithubLinkSource | null
  linkedAt: string | null
  isDraft: boolean | null
  viaIssue: GithubRef | null
  closesIssues: GithubClosingIssue[] | null
  diff: GithubDiff | null
  ci: GithubCi | null
  /** 빈 배열 = Case 전체 근거 */
  stepIds: number[]
  /** Issue 에만 — 이 Issue 아래에 보일 PR */
  pullRequests: GithubEvidenceItem[] | null
}

export interface GithubEvidenceEvent {
  id: number
  type: string
  occurredAt: string
  kind: GithubRefKind
  repo: string | null
  number: number | null
  masked: boolean
  /** PR_LINKED(그 Issue 를 닫는 PR 이라 자동 연결)·REF_REMOVED 가 가리키는 Issue */
  issue: GithubRef | null
  /** CI_COMPLETED: sha·conclusion·total·passed·failed (가려지면 conclusion 만) */
  data: Record<string, unknown>
}

export interface GithubActivity {
  events: GithubEvidenceEvent[]
  nextCursor: string | null
  hasNext: boolean
  totalCount: number
}

export interface CaseGithubEvidence {
  syncStopped: boolean
  issues: GithubEvidenceItem[]
  ungroupedPullRequests: GithubEvidenceItem[]
  maskedCount: number
  activity: GithubActivity
}

export interface GithubBackfilledPullRequest {
  repo: string
  number: number
  title: string
  state: string
}

export interface GithubBackfill {
  attached: number
  failed: number
  pullRequests: GithubBackfilledPullRequest[]
  skipped: GithubRef[]
}

export interface CaseGithubLinkResponse {
  linkId: number
  kind: GithubRefKind
  repoId: number
  number: number
  linkSource: GithubLinkSource
  linkedAt: string
  /** false = 이미 연결돼 있었음 */
  created: boolean
  backfill: GithubBackfill
}
