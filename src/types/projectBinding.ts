// core-api agentcapture 프로젝트 바인딩(/api/v1/me/project-bindings, /api/v1/me/cases/{caseId}/project-binding)
// — ProjectBindingDtos.kt 와 1:1. 프로젝트는 기록 분류 기준이며 Case 읽기 권한을 제한하지 않는다.

/** 프로젝트 바인딩. ProjectBindingResponse. */
export interface ProjectBinding {
  id: number
  /** 사용자가 정한 프로젝트 식별자(로컬 경로 매핑은 커넥터가 설정). */
  projectKey: string
  /** 정규화 repo 식별자(GitHub 연결 시). 이름만으로 권한 확대 X. */
  normalizedRepoId?: string | null
  storagePolicy: string
  createdAt: string
}

/** 프로젝트 바인딩 생성 요청. 같은 projectKey 가 있으면 기존 반환(멱등). CreateProjectBindingRequest. */
export interface CreateProjectBindingRequest {
  projectKey: string
  normalizedRepoId?: string | null
}

/** 기존 Case 를 ProjectBinding 에 귀속. AssignCaseProjectBindingRequest. */
export interface AssignCaseProjectBindingRequest {
  projectBindingId: number
}
