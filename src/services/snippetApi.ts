import apiClient from './apiClient'
import type { ApiResponse } from '@/types/api'
import type { Snippet, SnippetCreateRequest, SnippetUpdateRequest } from '@/types/error'

export const snippetApi = {
  list(errorId: string) {
    return apiClient.get<ApiResponse<Snippet[]>>(`/errors/${errorId}/snippets`)
  },

  create(errorId: string, data: SnippetCreateRequest) {
    return apiClient.post<ApiResponse<Snippet>>(`/errors/${errorId}/snippets`, data)
  },

  update(errorId: string, snippetId: string, data: SnippetUpdateRequest) {
    return apiClient.put<ApiResponse<Snippet>>(`/errors/${errorId}/snippets/${snippetId}`, data)
  },

  delete(errorId: string, snippetId: string) {
    return apiClient.delete<ApiResponse<null>>(`/errors/${errorId}/snippets/${snippetId}`)
  },
}
