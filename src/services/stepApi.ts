import apiClient from './apiClient'
import type { ApiResponse } from '@/types/api'
import type { Step, StepCreateRequest, StepUpdateRequest } from '@/types/error'

export const stepApi = {
  list(errorId: string) {
    return apiClient.get<ApiResponse<Step[]>>(`/errors/${errorId}/steps`)
  },

  create(errorId: string, data: StepCreateRequest) {
    return apiClient.post<ApiResponse<Step>>(`/errors/${errorId}/steps`, data)
  },

  update(errorId: string, stepId: string, data: StepUpdateRequest) {
    return apiClient.put<ApiResponse<Step>>(`/errors/${errorId}/steps/${stepId}`, data)
  },

  delete(errorId: string, stepId: string) {
    return apiClient.delete<ApiResponse<null>>(`/errors/${errorId}/steps/${stepId}`)
  },
}
