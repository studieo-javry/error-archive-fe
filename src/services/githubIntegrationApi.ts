import apiClient from './apiClient'
import type {
  CompleteGithubInstallationRequest,
  GithubInstallUrlResponse,
  GithubInstallation,
} from '@/types/githubIntegration'

// core-api /integrations/github — GitHub App 연결(P0).
export const githubIntegrationApi = {
  /** 설치 페이지 URL(+서명된 state). workspaceId 생략 = 개인 연결, 주면 그 워크스페이스(ADMIN 필요). */
  getInstallUrl(workspaceId: number | null) {
    return apiClient.get<GithubInstallUrlResponse>('/integrations/github/install-url', {
      params: workspaceId != null ? { workspaceId } : undefined,
    })
  },
  /** GitHub 설치 후 돌아온 installation_id·code·state 로 연결 완료. */
  completeInstallation(data: CompleteGithubInstallationRequest) {
    return apiClient.post<GithubInstallation>('/integrations/github/installations', data)
  },
  /** 내가 연결했거나 내가 속한 워크스페이스에 연결된 설치. */
  listInstallations() {
    return apiClient.get<GithubInstallation[]>('/integrations/github/installations')
  },
}
