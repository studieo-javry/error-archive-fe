import apiClient from './apiClient'
import type {
  GithubAuthorizeUrlResponse,
  GithubConnection,
  GithubConnectionCandidates,
  GithubConnectionOptions,
  RefreshRepositoriesResult,
} from '@/types/githubConnection'

// core-api /integrations/github — 멀티-공간 연결(2차). 설치 1건을 여러 공간에 연결하고 공간별 레포를 선택한다.
export const githubConnectionApi = {
  /** 연결 옵션(시나리오 ②) — 저장 토큰이 있으면 GitHub 재이동 없이 바로 후보. discoveryStatus 로 분기. */
  getConnectionOptions(workspaceId: number | null) {
    return apiClient.get<GithubConnectionOptions>('/integrations/github/connection-options', {
      params: workspaceId != null ? { workspaceId } : undefined,
    })
  },
  /** OAuth 인가 URL(+서명 state). 저장 토큰이 없을 때 이 URL 로 이동해 사용자 토큰을 받는다. */
  getAuthorizeUrl(workspaceId: number | null) {
    return apiClient.get<GithubAuthorizeUrlResponse>('/integrations/github/authorize-url', {
      params: workspaceId != null ? { workspaceId } : undefined,
    })
  },
  /** OAuth 콜백의 code·state → 접근 가능한 설치 후보 + candidateToken. code 는 여기서 한 번만 사용. */
  getCandidates(code: string, state: string) {
    return apiClient.post<GithubConnectionCandidates>('/integrations/github/connection-candidates', { code, state })
  },
  /** 내 공간들(개인 + 내가 속한 워크스페이스)의 ACTIVE 연결 + 선택/가능 레포. */
  listConnections() {
    return apiClient.get<GithubConnection[]>('/integrations/github/connections')
  },
  /** candidateToken + 선택 레포로 설치를 이 공간에 연결(생성/재활성). */
  createConnection(candidateToken: string, selectedRepoIds: number[]) {
    return apiClient.post<GithubConnection>('/integrations/github/connections', { candidateToken, selectedRepoIds })
  },
  /** 이 연결의 사용 레포를 교체(replace-set). expectedVersion 지정 시 불일치면 409. */
  updateRepositories(connectionId: number, selectedRepoIds: number[], expectedVersion: number | null) {
    return apiClient.put<GithubConnection>(`/integrations/github/connections/${connectionId}/repositories`, {
      selectedRepoIds,
      ...(expectedVersion != null ? { expectedVersion } : {}),
    })
  },
  /** 이 공간에서만 연결 해제(disconnect, 멱등). 설치·레포·다른 공간은 유지. */
  disconnect(connectionId: number) {
    return apiClient.delete<void>(`/integrations/github/connections/${connectionId}`)
  },
  /** GitHub Configure 에서 접근 범위를 바꾸고 돌아온 뒤 설치 grant 재동기화(새 레포는 후보로만). */
  refreshRepositories(installationId: number) {
    return apiClient.post<RefreshRepositoriesResult>(`/integrations/github/installations/${installationId}/refresh-repositories`)
  },
}
