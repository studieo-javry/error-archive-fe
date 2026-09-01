import apiClient from './apiClient'
import type { CursorPaginatedResponse } from '@/types/api'
import type {
  ErrorCaseDetail,
  ErrorCaseSummary,
  ErrorCaseCreateRequest,
  ErrorCaseCreateResponse,
  ErrorCaseUpdateRequest,
  MeTooResponse,
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

  search(params?: {
    q?: string
    status?: string
    severity?: number
    workspaceId?: number
    cursor?: string
    size?: number
  }) {
    return apiClient.get<CursorPaginatedResponse<ErrorCaseSummary>>('/error-cases/search', { params })
  },

  // "나도 겪었어요"(me-too) 토글 — 본인 케이스는 403(멱등). 응답에 최신 count/taggedByMe/userIds.
  markMeToo(id: number) {
    return apiClient.post<MeTooResponse>(`/error-cases/${id}/me-too`)
  },

  unmarkMeToo(id: number) {
    return apiClient.delete<MeTooResponse>(`/error-cases/${id}/me-too`)
  },
}
