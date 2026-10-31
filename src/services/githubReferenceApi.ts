import apiClient from './apiClient'
import type { GithubReference, GithubReferenceRepository, GithubReferenceSearchItem } from '@/types/githubReference'

// core-api 본문 GitHub 참조 — `#` 자동완성(공간 기준)과 읽기 화면 조회(Case 기준).
const scopeParams = (workspaceId: number | null) => (workspaceId != null ? { workspaceId } : {})

export const githubReferenceApi = {
  /** `#` 자동완성 대상 레포 — Case 가 속한(속할) 공간에 연결된 활성 레포. 비면 자동완성 없음. */
  repositories(workspaceId: number | null) {
    return apiClient.get<{ repositories: GithubReferenceRepository[] }>('/integrations/github/reference-repositories', {
      params: scopeParams(workspaceId),
    })
  },
  /** `#` 뒤 입력(번호·제목)으로 Issue·PR 검색. 레포 이름 → 번호 순 최대 8개. */
  search(workspaceId: number | null, q: string) {
    return apiClient.get<{ items: GithubReferenceSearchItem[] }>('/integrations/github/reference-search', {
      params: { ...scopeParams(workspaceId), q },
    })
  },
  /** 본문에 적힌 `owner/repo#N` → 제목·종류·상태. */
  resolve(caseId: number, refs: string[]) {
    return apiClient.post<{ references: GithubReference[] }>(`/error-cases/${caseId}/github/references`, { refs })
  },
}
