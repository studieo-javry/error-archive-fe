import apiClient from './apiClient'
import type {
  ActiveCaseCard,
  RecentActivitiesResponse,
  WatchlistItem,
  WatchlistFeedItem,
  RecommendedUser,
  FollowingFeedItem,
} from '@/types/home'

/** Insight Home dashboard endpoints (mocked via MSW until BE is ready). */
export const meApi = {
  recentActiveCases() {
    return apiClient.get<ActiveCaseCard[]>('/users/me/recent-active-cases')
  },

  recentActivities() {
    return apiClient.get<RecentActivitiesResponse>('/users/me/recent-activities')
  },

  watchlist() {
    return apiClient.get<WatchlistItem[]>('/users/me/watchlist')
  },

  watchlistFeed() {
    return apiClient.get<WatchlistFeedItem[]>('/users/me/watchlist-feed')
  },

  addWatchlist(caseId: number) {
    return apiClient.post<{ watching: boolean }>(`/error-cases/${caseId}/watchlist`)
  },

  removeWatchlist(caseId: number) {
    return apiClient.delete<void>(`/error-cases/${caseId}/watchlist`)
  },

  followingFeed() {
    return apiClient.get<FollowingFeedItem[]>('/users/me/following-feed')
  },

  recommendedUsers() {
    return apiClient.get<RecommendedUser[]>('/users/me/recommended-users')
  },
}
