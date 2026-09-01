import apiClient from './apiClient'
import type { MyPendingSnippet, SnippetCreateRequest, SnippetCreateResponse, SnippetDetail, SnippetUpdateRequest } from '@/types/error'

export const snippetApi = {
  // 케이스에 아직 연결 안 한 내 pending 스니펫 목록 (최신순, 최대 100).
  listMine() {
    return apiClient.get<MyPendingSnippet[]>('/error-snippets/mine')
  },

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
