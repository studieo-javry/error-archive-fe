// core-api GitHub 멀티-공간 연결(2차) — GithubConnectionDtos.kt 와 1:1.

/** 설치 저장소(선택/가능). GithubRepositoryResponse */
export interface GithubRepositoryRef {
  repoId: number
  /** owner/name */
  fullName: string
  isPrivate: boolean
}

/** 후보 저장소 — eligible=이 공간에서 선택 가능(개인=read / 워크스페이스=admin), permission=ADMIN|WRITE|READ */
export interface GithubCandidateRepository extends GithubRepositoryRef {
  eligible: boolean
  permission: string
}

/** 연결 후보 — 접근 가능한 설치 1건 + grant 레포 + 서명 토큰 */
export interface GithubConnectionCandidate {
  installationId: number
  accountLogin: string
  accountType: string
  alreadyConnected: boolean
  candidateToken: string
  repositories: GithubCandidateRepository[]
}

export interface GithubConnectionCandidates {
  /** null = 개인 연결 */
  workspaceId: number | null
  candidates: GithubConnectionCandidate[]
}

/** connection-options discoveryStatus */
export type DiscoveryStatus = 'NOT_AUTHORIZED' | 'VERIFIED_EMPTY' | 'VERIFIED_AVAILABLE' | 'TEMPORARY_FAILURE'

export interface GithubConnectionOptions {
  status: DiscoveryStatus
  workspaceId: number | null
  /** NOT_AUTHORIZED 일 때 이동할 OAuth 인가 URL */
  authorizeUrl: string | null
  /** VERIFIED_EMPTY 일 때 이동할 설치 URL */
  installUrl: string | null
  /** VERIFIED_AVAILABLE 일 때 바로 쓸 후보 */
  candidates: GithubConnectionCandidate[]
}

export type GithubConnectionStatus = 'ACTIVE' | 'DISCONNECTED'

/** 공간 연결(관리 목록 1건) */
export interface GithubConnection {
  connectionId: number
  installationId: number
  accountLogin: string
  accountType: string
  /** null = 개인 연결 */
  workspaceId: number | null
  status: GithubConnectionStatus
  connectedByUserId: number
  /** 이 공간에서 사용 선택한 레포 */
  selectedRepositories: GithubRepositoryRef[]
  /** 선택 가능한(설치 grant) 레포 전체 */
  availableRepositories: GithubRepositoryRef[]
  /** 낙관적 락 버전 — 레포 선택 변경 시 expectedVersion 으로 되돌려 보낸다 */
  version: number
  connectedAt: string
}

export interface RefreshRepositoriesResult {
  installationId: number
  availableRepositories: GithubRepositoryRef[]
  addedRepoIds: number[]
  removedRepoIds: number[]
}

export interface GithubAuthorizeUrlResponse {
  url: string
}
