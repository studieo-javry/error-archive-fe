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
