import apiClient from './apiClient'
import type { ApiResponse, PaginatedResponse } from '@/types/api'
import type { Notification, NotificationSettings } from '@/types/notification'

export const notificationApi = {
  list(params?: { page?: number; size?: number; unreadOnly?: boolean }) {
    return apiClient.get<ApiResponse<PaginatedResponse<Notification>>>('/notifications', { params })
  },

  unreadCount() {
    return apiClient.get<ApiResponse<{ count: number }>>('/notifications/unread-count')
  },

  markRead(id: string) {
    return apiClient.patch<ApiResponse<null>>(`/notifications/${id}/read`)
  },

  markAllRead() {
    return apiClient.patch<ApiResponse<null>>('/notifications/read-all')
  },

  getSettings() {
    return apiClient.get<ApiResponse<NotificationSettings>>('/notifications/settings')
  },

  updateSettings(settings: NotificationSettings) {
    return apiClient.put<ApiResponse<NotificationSettings>>('/notifications/settings', settings)
  },
}
