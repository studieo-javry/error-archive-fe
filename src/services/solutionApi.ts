import apiClient from './apiClient'
import type { Solution, SolutionCreateRequest } from '@/types/error'

export const solutionApi = {
  list(caseId: number) {
    return apiClient.get<Solution[]>(`/error-cases/${caseId}/solutions`)
  },

  create(caseId: number, data: SolutionCreateRequest) {
    return apiClient.post<Solution>(`/error-cases/${caseId}/solutions`, data)
  },

  delete(caseId: number, solutionId: number) {
    return apiClient.delete<void>(`/error-cases/${caseId}/solutions/${solutionId}`)
  },
}
