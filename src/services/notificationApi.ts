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
    return apiClient.get<NotificationSettings>('/users/me/notification-settings')
  },

  updateSettings(settings: Partial<NotificationSettings>) {
    return apiClient.patch<NotificationSettings>('/users/me/notification-settings', settings)
  },
}
