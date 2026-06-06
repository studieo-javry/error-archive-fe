import apiClient from './apiClient'
import type { CursorPaginatedResponse } from '@/types/api'
import type {
  ErrorCaseDetail,
  ErrorCaseSummary,
  ErrorCaseCreateRequest,
  ErrorCaseCreateResponse,
  ErrorCaseUpdateRequest,
} from '@/types/error'

export const errorApi = {
  list(params?: {
    workspaceId?: number
    status?: string
    severity?: number
    fingerprint?: string
    cursor?: string
    size?: number
  }) {
    return apiClient.get<CursorPaginatedResponse<ErrorCaseSummary>>('/error-cases', { params })
  },

  get(id: number) {
    return apiClient.get<ErrorCaseDetail>(`/error-cases/${id}`)
  },

  create(data: ErrorCaseCreateRequest) {
    return apiClient.post<ErrorCaseCreateResponse>('/error-cases', data)
  },

  update(id: number, data: ErrorCaseUpdateRequest) {
    return apiClient.patch<ErrorCaseDetail>(`/error-cases/${id}`, data)
  },

  delete(id: number) {
    return apiClient.delete<void>(`/error-cases/${id}`)
  },
}
