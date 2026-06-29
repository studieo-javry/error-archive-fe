// Insight Home (ERR-33) DTOs — shapes per specs/005-insight-home/plan.md Contracts.
// FE consumes these from MSW mocks (backend not running).

export type CaseActivitySource =
  | 'CASE_RESOLVED'
  | 'COMMENT_POSTED'
  | 'STEP_ADDED'
  | 'SOLUTION_REGISTERED'

/** Recent my active cases — owner's case with unread (others' activity since last view) + deltas. */
export interface ActiveCaseCard {
  caseId: number
  title: string
  status: string
  unread: number
  delta24h: number
  delta7d: number
  lastActivityAt: string
}

/** A single entry in my recent-activity timeline. */
export interface RecentActivity {
  id: number
  type: CaseActivitySource
  caseId: number
  caseTitle: string
  preview: string | null
  createdAt: string
}

/** Per-source count for the summary pills. */
export interface ActivitySummary {
  source: CaseActivitySource
  count: number
}

/** Response shape for GET /users/me/recent-activities. */
export interface RecentActivitiesResponse {
  items: RecentActivity[]
  summary: ActivitySummary[]
}

/** Simple watchlist case summary. */
export interface WatchlistItem {
  caseId: number
  title: string
  status: string
}

/** Watchlist activity feed entry (sorted by lastUpdated desc). */
export interface WatchlistFeedItem {
  caseId: number
  title: string
  activityType: 'SOLUTION' | 'RESOLVED' | 'STEP' | 'COMMENT'
  avatarUrl: string | null
  displayName: string
  lastUpdated: string
}

/** Recommended user shown when not following anyone. */
export interface RecommendedUser {
  userId: number
  avatarUrl: string | null
  displayName: string
  handle: string
  bio: string | null
  tags: string[]
  following: boolean
}

/** New-case feed entry from a user I follow. */
export interface FollowingFeedItem {
  caseId: number
  title: string
  createdAt: string
  author: {
    userId: number
    displayName: string
    handle: string
    avatarUrl: string | null
  }
}
