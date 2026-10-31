// core-api 본문 GitHub 참조 — GithubReferenceDtos.kt 와 1:1.
import type { GithubRefKind } from './githubEvidence'

export interface GithubReferenceRepository {
  repoId: number
  fullName: string
  isPrivate: boolean
}

export interface GithubReferenceSearchItem {
  repo: string
  number: number
  kind: GithubRefKind
  title: string
  /** OPEN | CLOSED | MERGED(PR) */
  status: string
}

export interface GithubReference {
  /** 요청한 `owner/repo#N` 그대로 */
  ref: string
  repo: string
  number: number
  resolved: boolean
  /** 비공개 레포라 요청자에게 가림 — 제목·상태 없음 */
  masked: boolean
  kind: GithubRefKind | null
  title: string | null
  status: string | null
  url: string | null
}
