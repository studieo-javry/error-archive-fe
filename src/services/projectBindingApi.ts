import apiClient from './apiClient'
import type {
  AssignCaseProjectBindingRequest,
  CreateProjectBindingRequest,
  ProjectBinding,
} from '@/types/projectBinding'

interface ProjectBindingListResponse {
  items: ProjectBinding[]
}

// core-api /me/project-bindings — 수집 기록·기존 Case 를 프로젝트별로 묶는 분류. Case 읽기 권한을 제한하지 않음.
export const projectBindingApi = {
  /** 내 프로젝트 바인딩 목록. */
  list() {
    return apiClient.get<ProjectBindingListResponse>('/me/project-bindings')
  },
  /** 프로젝트 바인딩 생성(같은 projectKey 면 기존 반환, 멱등). */
  create(request: CreateProjectBindingRequest) {
    return apiClient.post<ProjectBinding>('/me/project-bindings', request)
  },
  /**
   * 기존 Case 를 ProjectBinding 에 귀속. 본인 소유 Case + 본인 소유 Binding 만.
   * ⚠️ BE 에 현재 귀속값 GET 이 없어 사전 조회 불가 — 변경(지정/해제)만 가능.
   */
  bindCase(caseId: number, request: AssignCaseProjectBindingRequest) {
    return apiClient.put<void>(`/me/cases/${caseId}/project-binding`, request)
  },
  /** Case 의 프로젝트 귀속 해제. */
  unbindCase(caseId: number) {
    return apiClient.delete<void>(`/me/cases/${caseId}/project-binding`)
  },
}

export default projectBindingApi
