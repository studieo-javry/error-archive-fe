import apiClient from './apiClient'
import type { SnippetCreateRequest, SnippetCreateResponse, SnippetDetail, SnippetUpdateRequest } from '@/types/error'

export const snippetApi = {
  create(data: SnippetCreateRequest) {
    return apiClient.post<SnippetCreateResponse>('/error-snippets', data)
  },

  update(markerId: string, data: SnippetUpdateRequest) {
    return apiClient.patch<SnippetDetail>(`/error-snippets/${markerId}`, data)
  },

  delete(markerId: string) {
    return apiClient.delete<void>(`/error-snippets/${markerId}`)
  },
}
