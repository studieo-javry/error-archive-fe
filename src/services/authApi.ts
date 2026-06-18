import apiClient from './apiClient'
import type {
  TokenResponse,
  AuthorizeUrlResponse,
  MyProfile,
  PublicProfile,
  Connection,
  Session,
  FollowActionResponse,
  FollowStatusResponse,
} from '@/types/user'
import type { OffsetPaginatedResponse } from '@/types/api'
import type { UserSummary } from '@/types/user'

export const authApi = {
  authorize(redirectUri: string, returnUrl?: string) {
    return apiClient.post<AuthorizeUrlResponse>('/auth/oauth/github/authorize', { redirectUri, returnUrl })
  },

  callback(code: string, state: string, redirectUri: string, rememberMe: boolean) {
    return apiClient.post<TokenResponse>('/auth/oauth/github/callback', { code, state, redirectUri, rememberMe })
  },

  refresh() {
    return apiClient.post<TokenResponse>('/auth/refresh')
  },

  logout() {
    return apiClient.post<void>('/auth/logout')
  },

  getMe() {
    return apiClient.get<MyProfile>('/users/me')
  },

  updateProfile(data: {
    displayName?: string
    avatarUrl?: string
    bio?: string
    clearAvatar?: boolean
    clearBio?: boolean
    language?: string
    clearLanguage?: boolean
    timezone?: string
    clearTimezone?: boolean
    theme?: 'LIGHT' | 'DARK' | 'SYSTEM'
    defaultWorkspaceId?: number
    clearDefaultWorkspace?: boolean
  }) {
    return apiClient.patch<MyProfile>('/users/me', data)
  },

  deleteAccount() {
    return apiClient.delete<void>('/users/me')
  },

  restoreAccount() {
    return apiClient.post<void>('/users/me/restore')
  },

  getConnections() {
    return apiClient.get<Connection[]>('/users/me/connections')
  },

  disconnectProvider(provider: string) {
    return apiClient.delete<void>(`/users/me/connections/${provider}`)
  },

  uploadAvatar(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<MyProfile>('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  removeAvatar() {
    return apiClient.delete<MyProfile>('/users/me/avatar')
  },

  getSessions() {
    return apiClient.get<Session[]>('/users/me/sessions')
  },

  revokeSession(sessionId: string) {
    return apiClient.delete<void>(`/users/me/sessions/${sessionId}`)
  },

  revokeAllSessions() {
    return apiClient.post<void>('/users/me/sessions/revoke-all')
  },

  getUser(id: number) {
    return apiClient.get<PublicProfile>(`/users/${id}`)
  },

  follow(userId: number) {
    return apiClient.put<FollowActionResponse>(`/users/${userId}/follow`)
  },

  unfollow(userId: number) {
    return apiClient.delete<FollowActionResponse>(`/users/${userId}/follow`)
  },

  getFollowStatus(userId: number) {
    return apiClient.get<FollowStatusResponse>(`/users/${userId}/follow-status`)
  },

  getFollowers(userId: number, params?: { page?: number; size?: number }) {
    return apiClient.get<OffsetPaginatedResponse<UserSummary>>(`/users/${userId}/followers`, { params })
  },

  getFollowing(userId: number, params?: { page?: number; size?: number }) {
    return apiClient.get<OffsetPaginatedResponse<UserSummary>>(`/users/${userId}/following`, { params })
  },
}
