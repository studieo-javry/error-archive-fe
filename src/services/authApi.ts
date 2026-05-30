import apiClient from './apiClient'
import type { TokenResponse, AuthorizeUrlResponse, UserProfile } from '@/types/user'

export const authApi = {
  authorize(redirectUri: string) {
    return apiClient.post<AuthorizeUrlResponse>('/auth/oauth/github/authorize', { redirectUri })
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
    return apiClient.get<UserProfile>('/users/me')
  },

  updateProfile(data: { displayName?: string; avatarUrl?: string; bio?: string; clearAvatar?: boolean; clearBio?: boolean }) {
    return apiClient.patch<UserProfile>('/users/me', data)
  },

  getUser(id: string) {
    return apiClient.get<UserProfile>(`/users/${id}`)
  },

  toggleFollow(id: string) {
    return apiClient.post<{ isFollowing: boolean }>(`/users/${id}/follow`)
  },
}
