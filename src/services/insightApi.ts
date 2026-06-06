import apiClient from './apiClient'

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
  user: { id: number; displayName: string; avatarUrl: string | null }
  score: number
  errorCount: number
  solutionCount: number
}

export const insightApi = {
  dashboard() {
    return apiClient.get<{ recentErrors: unknown[]; stats: KpiStats }>('/dashboard')
  },

  activity(year?: number) {
    return apiClient.get<ActivityDay[]>('/insights/activity', { params: { year } })
  },

  kpi() {
    return apiClient.get<KpiStats>('/insights/kpi')
  },

  leaderboard(limit = 10) {
    return apiClient.get<LeaderboardEntry[]>('/insights/leaderboard', { params: { limit } })
  },
}
