export interface MyProfile {
  userId: number
  email: string | null
  displayName: string
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
  displayName: string
  avatarUrl: string | null
  bio: string | null
  status: string
  isDeleted: boolean
}

export interface UserSummary {
  userId: number
  displayName: string
  avatarUrl: string | null
}

export interface TokenResponse {
  tokenType: string
  accessToken: string
  accessTokenExpiresAt: string
  userId: number
  redirectTo: string | null
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
