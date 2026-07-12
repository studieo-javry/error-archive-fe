import apiClient from './apiClient'
import type { AppNotification, NotificationSettings } from '@/types/notification'

export const notificationApi = {
  // Inbox list (newest first). `since` (SSE catchup cursor) exists on BE but is unused per current policy.
  list(params?: { unreadOnly?: boolean; limit?: number; offset?: number; since?: number }) {
    return apiClient.get<AppNotification[]>('/users/me/notifications', { params })
  },

  unreadCount() {
    return apiClient.get<{ count: number }>('/users/me/notifications/unread-count')
  },

  markRead(id: number) {
    return apiClient.post<void>(`/users/me/notifications/${id}/read`)
  },

  markAllRead() {
    return apiClient.post<void>('/users/me/notifications/read-all')
  },

  // Short-lived ticket for the SSE channel (EventSource can't send Authorization headers).
  sseTicket() {
    return apiClient.post<{ ticket: string; expiresAt: string }>('/auth/sse-ticket')
  },

  // ── Settings (legacy shape; BE alignment deferred) ──
  getSettings() {
    return apiClient.get<NotificationSettings>('/users/me/notification-settings')
  },
  updateSettings(settings: Partial<NotificationSettings>) {
    return apiClient.patch<NotificationSettings>('/users/me/notification-settings', settings)
  },
}
