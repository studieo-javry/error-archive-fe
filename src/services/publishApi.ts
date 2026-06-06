import apiClient from './apiClient'

export interface Report {
  id: number
  errorCaseId: number
  snapshotData: unknown
  shareToken: string
  shareUrl: string
  createdAt: string
}

export const publishApi = {
  createReport(errorId: number) {
    return apiClient.post<Report>(`/error-cases/${errorId}/reports`)
  },

  getReport(shareToken: string) {
    return apiClient.get<Report>(`/reports/${shareToken}`)
  },

  forkSolution(solutionId: number) {
    return apiClient.post<{ forkedErrorId: number }>(`/solutions/${solutionId}/fork`)
  },

  toggleBookmark(solutionId: number) {
    return apiClient.post<{ isBookmarked: boolean }>(`/solutions/${solutionId}/bookmark`)
  },
}
