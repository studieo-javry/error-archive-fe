export interface UserProfile {
  id: string
  username: string
  displayName: string
  avatarUrl: string
  bio?: string
  githubUrl: string
  followerCount: number
  followingCount: number
  errorCount: number
  solutionCount: number
  isFollowing: boolean
  createdAt: string
}

export interface UserSummary {
  id: string
  username: string
  displayName: string
  avatarUrl: string
}

export interface TokenResponse {
  tokenType: string
  accessToken: string
  accessTokenExpiresAt: string
  userId: number
}

export interface AuthorizeUrlResponse {
  authorizationUrl: string
}
