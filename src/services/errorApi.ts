import apiClient from './apiClient'
import type { ApiResponse, PaginatedResponse } from '@/types/api'
import type { ErrorCase, ErrorCaseSummary, ErrorCaseCreateRequest, ErrorCaseUpdateRequest } from '@/types/error'

export const errorApi = {
  list(params?: { page?: number; size?: number; status?: string; visibility?: string; workspaceId?: string; search?: string; tag?: string }) {
    return apiClient.get<ApiResponse<PaginatedResponse<ErrorCaseSummary>>>('/errors', { params })
  },

  get(id: string) {
    return apiClient.get<ApiResponse<ErrorCase>>(`/errors/${id}`)
  },

  create(data: ErrorCaseCreateRequest) {
    return apiClient.post<ApiResponse<ErrorCase>>('/errors', data)
  },

  update(id: string, data: ErrorCaseUpdateRequest) {
    return apiClient.put<ApiResponse<ErrorCase>>(`/errors/${id}`, data)
  },

  delete(id: string) {
    return apiClient.delete<ApiResponse<null>>(`/errors/${id}`)
  },

  react(id: string) {
    return apiClient.post<ApiResponse<{ hasReacted: boolean; reactionCount: number }>>(`/errors/${id}/react`)
  },

  watch(id: string) {
    return apiClient.post<ApiResponse<{ isWatching: boolean }>>(`/errors/${id}/watch`)
  },

  search(q: string, params?: { page?: number; size?: number }) {
    return apiClient.get<ApiResponse<PaginatedResponse<ErrorCaseSummary>>>('/search', { params: { q, ...params } })
  },
}
