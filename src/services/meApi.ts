import apiClient from './apiClient'
import type {
  RecentActivitiesResponse,
  WatchlistFeedResponse,
  RecentActiveCasesResponse,
  FollowingFeedResponse,
  SuggestedFolloweesResponse,
} from '@/types/home'
import type { ErrorCaseSummary } from '@/types/error'

/**
 * Current-user dashboard endpoints (core-api /users/me/*).
 */
export const meApi = {
  // Home / My-page recent activity timeline (core-api).
  recentActivities(params?: { windowDays?: number; limit?: number }) {
    return apiClient.get<RecentActivitiesResponse>('/users/me/recent-activities', { params })
  },

  // 다른 사용자의 공개 활동 타임라인 (core-api PublicProfileController).
  recentActivitiesOf(userId: number, params?: { windowDays?: number; limit?: number }) {
    return apiClient.get<RecentActivitiesResponse>(`/users/${userId}/recent-activities`, { params })
  },

  // Cases the user explicitly watches (core-api). Returns full case summaries.
  watchlist(params?: { limit?: number }) {
    return apiClient.get<ErrorCaseSummary[]>('/users/me/watchlist', { params })
  },

  // Home "Watchlist · updates" feed (core-api).
  watchlistFeed(params?: { limit?: number }) {
    return apiClient.get<WatchlistFeedResponse>('/users/me/watchlist-feed', { params })
  },

  // Home "My recent active cases" widget (core-api).
  recentActiveCases(params?: { windowDays?: number; limit?: number }) {
    return apiClient.get<RecentActiveCasesResponse>('/users/me/recent-active-cases', { params })
  },

  // Home "Following · new cases" feed (core-api). Empty items → show suggested followees.
  followingFeed(params?: { limit?: number }) {
    return apiClient.get<FollowingFeedResponse>('/users/me/following-feed', { params })
  },

  // Suggested people to follow when the following feed is empty (core-api).
  suggestedFollowees(params?: { limit?: number }) {
    return apiClient.get<SuggestedFolloweesResponse>('/users/me/suggested-followees', { params })
  },

  // Watchlist toggle (core-api). Both return 204 (idempotent) — no body.
  addWatchlist(caseId: number) {
    return apiClient.post<void>(`/error-cases/${caseId}/watchlist`)
  },
  removeWatchlist(caseId: number) {
    return apiClient.delete<void>(`/error-cases/${caseId}/watchlist`)
  },
}
