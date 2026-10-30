import apiClient from './apiClient'
import type { CursorPaginatedResponse } from '@/types/api'
import type {
  ErrorCaseDetail,
  ErrorCaseSummary,
  ErrorCaseCreateRequest,
  ErrorCaseCreateResponse,
  ErrorCaseUpdateRequest,
  MeTooResponse,
  SimilarCaseListResponse,
  DraftSuggestionRequest,
  DraftSuggestionResponse,
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

  // 에러 원문 붙여넣기 → AI 초안 제안(제목·예외·요약·태그·심각도). 로그인 사용자 전용(게스트 403).
  draftSuggestion(data: DraftSuggestionRequest) {
    return apiClient.post<DraftSuggestionResponse>('/error-cases/draft-suggestion', data)
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

  // 유사 에러 추천 — 제목 입력 중 실시간. workspaceId 지정 시 그 WS 멤버 스코프, 미지정 시 본인 케이스.
  // 보조 기능이라 호출부에서 조용히 실패 처리(AbortController 로 직전 요청 취소).
  similar(params: { q: string; workspaceId?: number; limit?: number }, signal?: AbortSignal) {
    return apiClient.get<SimilarCaseListResponse>('/error-cases/similar', { params, signal })
  },

  // "나도 겪었어요"(me-too) 토글 — 본인 케이스는 403(멱등). 응답에 최신 count/taggedByMe/userIds.
  markMeToo(id: number) {
    return apiClient.post<MeTooResponse>(`/error-cases/${id}/me-too`)
  },

  unmarkMeToo(id: number) {
    return apiClient.delete<MeTooResponse>(`/error-cases/${id}/me-too`)
  },
}
