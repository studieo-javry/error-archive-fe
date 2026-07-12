// Home / My-page dashboard DTOs.
// Real endpoints (core-api): GET /users/me/{recent-activities, watchlist, watchlist-feed}.

// ── Recent activities (core-api GET /users/me/recent-activities) ──
export type RecentActivityType =
  | 'CASE_CREATED'
  | 'CASE_RESOLVED'
  | 'COMMENT_POSTED'
  | 'STEP_ADDED'
  | 'SOLUTION_REGISTERED'

export interface RecentActivity {
  type: RecentActivityType
  caseId: number
  caseTitle: string | null
  occurredAt: string
}

export interface RecentActivitiesResponse {
  items: RecentActivity[]
  windowDays: number
  summary: { byType: Record<string, number> }
}

// ── Watchlist feed (core-api GET /users/me/watchlist-feed) ──
export type WatchlistActivitySource =
  | 'CASE_RESOLVED'
  | 'COMMENT_POSTED'
  | 'STEP_ADDED'
  | 'SOLUTION_REGISTERED'

export interface WatchlistFeedItem {
  id: number
  title: string
  status: string
  visibility: string
  severity: number | null
  workspaceId: number | null
  latestActivitySource: WatchlistActivitySource
  latestActivityActorUserId: number | null
  lastActivityAt: string
  unreadActivityCount: number
  /** core-api path (+ optional #anchor). FE maps caseId → /w/:slug/errors/:id. */
  detailUrl: string
}

export interface WatchlistFeedResponse {
  items: WatchlistFeedItem[]
}
