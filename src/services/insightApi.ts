import apiClient from './apiClient'
import type { ApiResponse } from '@/types/api'

export interface ActivityDay {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

export interface KpiStats {
  totalErrors: number
  totalSteps: number
  totalSolutions: number
  resolvedRate: number
  avgResolutionTime: number
}

export interface LeaderboardEntry {
  rank: number
  user: { id: string; username: string; displayName: string; avatarUrl: string }
  score: number
  errorCount: number
  solutionCount: number
}

export const insightApi = {
  dashboard() {
    return apiClient.get<ApiResponse<{ recentErrors: unknown[]; stats: KpiStats }>>('/dashboard')
  },

  activity(year?: number) {
    return apiClient.get<ApiResponse<ActivityDay[]>>('/insights/activity', { params: { year } })
  },

  kpi() {
    return apiClient.get<ApiResponse<KpiStats>>('/insights/kpi')
  },

  leaderboard(limit = 10) {
    return apiClient.get<ApiResponse<LeaderboardEntry[]>>('/insights/leaderboard', { params: { limit } })
  },
}
