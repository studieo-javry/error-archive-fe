export interface MyProfile {
  userId: number
  email: string | null
  displayName: string
  handle: string
  avatarUrl: string | null
  bio: string | null
  status: 'ACTIVE' | 'PENDING_DELETION' | 'SUSPENDED' | 'DELETED'
  pendingDeletionAt: string | null
  createdAt: string
  language: string | null
  timezone: string | null
  theme: 'LIGHT' | 'DARK' | 'SYSTEM'
  defaultWorkspaceId: number | null
}

export interface Session {
  sessionId: string
  deviceLabel: string
  userAgent: string
  ipAddress: string
  createdAt: string
  lastUsedAt: string
  expiresAt: string
  rememberMe: boolean
}

export interface PublicProfile {
  userId: number
  handle: string
  displayName: string
  avatarUrl: string | null
  bio: string | null
  status: string
  isDeleted: boolean
}

export interface UserSummary {
  userId: number
  handle: string
  displayName: string
  avatarUrl: string | null
  /** 팔로워/팔로잉 목록에서만: 로그인 viewer 가 이 사용자를 팔로우 중인지(비로그인이면 false). */
  isFollowing?: boolean
  /** 팔로워/팔로잉 목록에서만: 이 사용자가 viewer 본인인지(본인 행은 팔로우 버튼 숨김). */
  isSelf?: boolean
}

export interface TokenResponse {
  tokenType: string
  accessToken: string
  accessTokenExpiresAt: string
  userId: number
  redirectTo: string | null
}

/** "로그인 없이 둘러보기"(게스트) 토큰 응답 — OAuth 없이 임시 세션 발급. */
export interface GuestTokenResponse {
  tokenType: string
  accessToken: string
  accessTokenExpiresAt: string
  userId: number
  workspaceId: number
  workspaceSlug: string
  displayName: string
  /**
   * 데모 시드 케이스의 공개 아티클 — 사용 가이드 4단계("발행된 글 읽기")가 연다.
   * BE 가 아직 내려주지 않으면 undefined/null → 가이드는 3단계 + 완료로 진행한다.
   */
  demoArticle?: DemoArticle | null
}

export interface DemoArticle {
  /** 아티클의 원본 케이스 — 가이드가 따라갈 샘플 케이스로도 쓴다. */
  caseId: number
  slug: string
  /** 공개 페이지 URL (/p/{slug}). */
  publicUrl: string
}

export interface AuthorizeUrlResponse {
  authorizationUrl: string
}

export interface Connection {
  provider: string
  providerEmail: string | null
  profileUrl: string | null
  linkedAt: string
}

export interface FollowActionResponse {
  followerId: number
  followeeId: number
  following: boolean
  changed: boolean
}

export interface FollowStatusResponse {
  userId: number
  followersCount: number
  followingCount: number
  viewerFollowsTarget: boolean
  targetFollowsViewer: boolean
  isMutual: boolean
  isSelf: boolean
}
