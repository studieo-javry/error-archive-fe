import apiClient from './apiClient'
import type {
  RecentActivitiesResponse,
  WatchlistFeedResponse,
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

  // Cases the user explicitly watches (core-api). Returns full case summaries.
  watchlist(params?: { limit?: number }) {
    return apiClient.get<ErrorCaseSummary[]>('/users/me/watchlist', { params })
  },

  // Home "Watchlist · updates" feed (core-api).
  watchlistFeed(params?: { limit?: number }) {
    return apiClient.get<WatchlistFeedResponse>('/users/me/watchlist-feed', { params })
  },

  // Watchlist toggle (core-api). Both return 204 (idempotent) — no body.
  addWatchlist(caseId: number) {
    return apiClient.post<void>(`/error-cases/${caseId}/watchlist`)
  },
  removeWatchlist(caseId: number) {
    return apiClient.delete<void>(`/error-cases/${caseId}/watchlist`)
  },
}
