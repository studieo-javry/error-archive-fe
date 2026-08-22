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

/** Activity actor profile on a watchlist card (null if the user is inactive/deleted). */
export interface WatchlistFeedActor {
  userId: number
  handle: string
  displayName: string
  avatarUrl: string | null
}

export interface WatchlistFeedItem {
  id: number
  title: string
  status: string
  visibility: string
  severity?: number | null
  workspaceId: number | null
  latestActivitySource: WatchlistActivitySource
  latestActivityActorUserId: number | null
  actor: WatchlistFeedActor | null
  lastActivityAt: string
  unreadActivityCount: number
  /** core-api path (+ optional #anchor). FE maps caseId → /w/:slug/errors/:id. */
  detailUrl: string
}

export interface WatchlistFeedResponse {
  items: WatchlistFeedItem[]
}

// ── My recent active cases (core-api GET /users/me/recent-active-cases) ──
export interface RecentActiveCase {
  id: number
  title: string
  status: string
  visibility: string
  workspaceId: number | null
  stepCount: number
  commentCount: number
  solutionCount: number
  meTooCount: number
  createdAt: string
  lastActivityAt: string
  /** activity by others since my last view (all activity if never viewed) */
  unreadCount: number
  commentDelta24h: number
  commentDelta7d: number
  meTooDelta24h: number
  meTooDelta7d: number
}
export interface RecentActiveCasesResponse {
  items: RecentActiveCase[]
}

// ── Following feed — recent PUBLIC cases from people I follow (core-api GET /users/me/following-feed) ──
export interface FollowingFeedAuthor {
  userId: number
  handle: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
}
export interface FollowingFeedItem {
  id: number
  ownerUserId: number
  title: string
  status: string
  createdAt: string
  tags: string[]
  author: FollowingFeedAuthor | null
}
export interface FollowingFeedResponse {
  items: FollowingFeedItem[]
}

// ── Suggested followees (AuthorSummary; shown when the following feed is empty) ──
export interface AuthorSummary {
  userId: number
  handle: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
  isFollowing: boolean
}
export interface SuggestedFolloweesResponse {
  items: AuthorSummary[]
}
