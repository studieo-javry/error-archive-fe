// core-api GitHub 연동(P0) — GithubInstallationDtos.kt 와 1:1.

export type GithubInstallationStatus = 'ACTIVE' | 'SUSPENDED'

export interface GithubRepository {
  /** GitHub repo id (rename 에도 불변) */
  repoId: number
  /** owner/name */
  fullName: string
  isPrivate: boolean
}

export interface GithubInstallation {
  installationId: number
  accountLogin: string
  /** 'Organization' | 'User' */
  accountType: string
  /** null = 개인 연결 */
  workspaceId: number | null
  installedByUserId: number
  status: GithubInstallationStatus
  /** 활성 레포만 */
  repositories: GithubRepository[]
  connectedAt: string
}

export interface GithubInstallUrlResponse {
  url: string
}

export interface CompleteGithubInstallationRequest {
  installationId: number
  code: string
  state: string
}
