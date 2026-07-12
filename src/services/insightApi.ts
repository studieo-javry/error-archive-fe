import apiClient from './apiClient'

// Mirrors insight-api's ActivityGrassResponse (GET /users/me/activity-grass).

export type ActivityCode =
  | 'CASE_CREATED'
  | 'CASE_RESOLVED'
  | 'CASE_PUBLISHED'
  | 'STEP_ADDED'
  | 'SOLUTION_ADDED'
  | 'COMMENT_POSTED'
  | 'COMMENT_REACTION'
  | 'COMMENT_HELPFUL'
  | 'FOLLOWED_USER'

export interface GrassDay {
  date: string // YYYY-MM-DD
  count: number
  score: number
  level: 0 | 1 | 2 | 3 | 4
  breakdown: Record<string, number>
}

export interface GrassStreak {
  current: number
  longest: number
  currentStartDate: string | null
}

export interface GrassTotals {
  events: number
  score: number
  activeDays: number
}

export interface GrassBestDay {
  date: string
  score: number
}

export interface GrassThresholds {
  mode: string
  l1: number
  l2: number
  l3: number
  l4: number
}

export interface ActivityGrassResponse {
  rangeFrom: string
  rangeTo: string
  timezone: string
  days: GrassDay[]
  streak: GrassStreak
  totals: GrassTotals
  bestDay: GrassBestDay | null
  thresholds: GrassThresholds
}

export type GrassMode = 'relative' | 'absolute'

// ── My KPIs (insight-api GET /users/me/kpis) ──
export interface KpiMetric {
  total: number
  weeklyDelta: number // last 7 days (incl. today), user timezone
}

export interface MyKpis {
  errorsRaised: KpiMetric // CASE_CREATED
  resolved: KpiMetric // CASE_RESOLVED
  stepsAdded: KpiMetric // STEP_ADDED
  solutions: KpiMetric // SOLUTION_ADDED
  published: KpiMetric // CASE_PUBLISHED
  resolutionRate: number // resolved.total / errorsRaised.total (0..1)
  publishRate: number // published.total / resolved.total (0..1)
}

export const insightApi = {
  myGrass(params?: { from?: string; to?: string; mode?: GrassMode }) {
    return apiClient.get<ActivityGrassResponse>('/users/me/activity-grass', { params })
  },

  userGrass(userId: number, params?: { from?: string; to?: string; mode?: GrassMode }) {
    return apiClient.get<ActivityGrassResponse>(`/users/${userId}/activity-grass`, { params })
  },

  myKpis() {
    return apiClient.get<MyKpis>('/users/me/kpis')
  },
}
