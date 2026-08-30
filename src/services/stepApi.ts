import apiClient from './apiClient'
import type { Step, StepCreateRequest, StepCreateResponse, StepUpdateRequest, StepUpdateResponse } from '@/types/error'

export const stepApi = {
  list(caseId: number) {
    return apiClient.get<Step[]>(`/error-cases/${caseId}/steps`)
  },

  create(caseId: number, data: StepCreateRequest) {
    return apiClient.post<StepCreateResponse>(`/error-cases/${caseId}/steps`, data)
  },

  update(caseId: number, stepId: number, data: StepUpdateRequest) {
    return apiClient.patch<StepUpdateResponse>(`/error-cases/${caseId}/steps/${stepId}`, data)
  },

  delete(caseId: number, stepId: number) {
    return apiClient.delete<void>(`/error-cases/${caseId}/steps/${stepId}`)
  },
}
