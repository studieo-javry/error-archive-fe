import apiClient from './apiClient'
import type { ApiResponse } from '@/types/api'
import type { Solution, SolutionCreateRequest } from '@/types/error'

export const solutionApi = {
  list(errorId: string) {
    return apiClient.get<ApiResponse<Solution[]>>(`/errors/${errorId}/solutions`)
  },

  create(errorId: string, data: SolutionCreateRequest) {
    return apiClient.post<ApiResponse<Solution>>(`/errors/${errorId}/solutions`, data)
  },
}
