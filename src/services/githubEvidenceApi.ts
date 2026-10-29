import apiClient from './apiClient'
import type { CaseGithubEvidence, CaseGithubLinkResponse, GithubActivity } from '@/types/githubEvidence'

// core-api /error-cases/{caseId}/github — Case GitHub 근거(P1-a·b·c).
export const githubEvidenceApi = {
  /** 관계형 근거 + GitHub 활동 첫 쪽(한 스냅샷). */
  get(caseId: number) {
    return apiClient.get<CaseGithubEvidence>(`/error-cases/${caseId}/github`)
  },
  /** 이전 GitHub 활동 — cursor 는 앞 쪽의 nextCursor. */
  events(caseId: number, cursor: string, size: number) {
    return apiClient.get<GithubActivity>(`/error-cases/${caseId}/github/events`, { params: { cursor, size } })
  },
  /** Issue·PR 주소로 연결. 이미 연결 200, 새로(또는 다시) 연결 201. */
  link(caseId: number, url: string) {
    return apiClient.post<CaseGithubLinkResponse>(`/error-cases/${caseId}/github/links`, { url })
  },
  detach(caseId: number, linkId: number) {
    return apiClient.delete<void>(`/error-cases/${caseId}/github/links/${linkId}`)
  },
  /** Step 의 근거 목록 교체(빈 목록 허용). */
  setStepLinks(caseId: number, stepId: number, linkIds: number[]) {
    return apiClient.put<void>(`/error-cases/${caseId}/github/steps/${stepId}/links`, { linkIds })
  },
}
