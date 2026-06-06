import apiClient from './apiClient'
import type { Notification, NotificationSettings } from '@/types/notification'

export const notificationApi = {
  list(params?: { page?: number; size?: number; unreadOnly?: boolean }) {
    return apiClient.get<{ items: Notification[]; total: number }>('/notifications', { params })
  },

  unreadCount() {
    return apiClient.get<{ count: number }>('/notifications/unread-count')
  },

  markRead(id: string) {
    return apiClient.patch<void>(`/notifications/${id}/read`)
  },

  markAllRead() {
    return apiClient.patch<void>('/notifications/read-all')
  },

  getSettings() {
    return apiClient.get<NotificationSettings>('/notifications/settings')
  },

  updateSettings(settings: NotificationSettings) {
    return apiClient.put<NotificationSettings>('/notifications/settings', settings)
  },
}
