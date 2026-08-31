import apiClient from './apiClient'
import type {
  Comment,
  CommentCreateRequest,
  CommentListResponse,
  MentionCandidate,
  SuggestionStatus,
} from '@/types/error'

export const commentApi = {
  // @멘션 자동완성 후보 (core-api). q=displayName/handle prefix, 빈 값=기본 추천.
  mentionCandidates(caseId: number, q: string, limit = 8) {
    return apiClient.get<MentionCandidate[]>(`/error-cases/${caseId}/mention-candidates`, {
      params: { q, limit },
    })
  },

  list(caseId: number, params?: {
    sort?: 'NEWEST' | 'OLDEST' | 'HELPFUL'
    quoteKind?: 'ALL' | 'GENERAL' | 'CASE_BODY' | 'STEP'
    cursor?: string
    size?: number
  }) {
    return apiClient.get<CommentListResponse>(`/error-cases/${caseId}/comments`, { params })
  },

  create(caseId: number, data: CommentCreateRequest) {
    return apiClient.post<Comment>(`/error-cases/${caseId}/comments`, data)
  },

  update(caseId: number, commentId: number, body: string) {
    return apiClient.patch<Comment>(`/error-cases/${caseId}/comments/${commentId}`, { body })
  },

  delete(caseId: number, commentId: number) {
    return apiClient.delete<void>(`/error-cases/${caseId}/comments/${commentId}`)
  },

  toggleHelpful(caseId: number, commentId: number) {
    return apiClient.post<{ helpedByMe: boolean; count: number; userIds: number[] }>(
      `/error-cases/${caseId}/comments/${commentId}/helpful`,
    )
  },

  addReaction(caseId: number, commentId: number, emoji: string) {
    return apiClient.post<{ emoji: string; count: number; userIds: number[]; reactedByMe: boolean }>(
      `/error-cases/${caseId}/comments/${commentId}/reactions`,
      { emoji },
    )
  },

  removeReaction(caseId: number, commentId: number, emoji: string) {
    return apiClient.delete<{ emoji: string; count: number; userIds: number[]; reactedByMe: boolean }>(
      `/error-cases/${caseId}/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`,
    )
  },

  updateSuggestionStatus(caseId: number, commentId: number, status: SuggestionStatus) {
    return apiClient.patch<{ commentId: number; status: SuggestionStatus; updatedAt: string }>(
      `/error-cases/${caseId}/comments/${commentId}/suggestion/status`,
      { status },
    )
  },
}
