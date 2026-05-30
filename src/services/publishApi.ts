import apiClient from './apiClient'
import type { ApiResponse } from '@/types/api'

export interface Report {
  id: string
  errorCaseId: string
  snapshotData: unknown
  shareToken: string
  shareUrl: string
  createdAt: string
}

export const publishApi = {
  createReport(errorId: string) {
    return apiClient.post<ApiResponse<Report>>(`/errors/${errorId}/reports`)
  },

  getReport(shareToken: string) {
    return apiClient.get<ApiResponse<Report>>(`/reports/${shareToken}`)
  },

  forkSolution(solutionId: string) {
    return apiClient.post<ApiResponse<{ forkedErrorId: string }>>(`/solutions/${solutionId}/fork`)
  },

  toggleBookmark(solutionId: string) {
    return apiClient.post<ApiResponse<{ isBookmarked: boolean }>>(`/solutions/${solutionId}/bookmark`)
  },
}
