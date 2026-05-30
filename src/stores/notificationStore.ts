import { defineStore } from 'pinia'
import { ref } from 'vue'
import { notificationApi } from '@/services/notificationApi'
import type { Notification } from '@/types/notification'

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)

  async function fetchUnreadCount() {
    const { data } = await notificationApi.unreadCount()
    unreadCount.value = data.data.count
  }

  async function fetchNotifications() {
    loading.value = true
    try {
      const { data } = await notificationApi.list({ size: 20 })
      notifications.value = data.data.items
    } finally {
      loading.value = false
    }
  }

  async function markRead(id: string) {
    await notificationApi.markRead(id)
    const notif = notifications.value.find((n) => n.id === id)
    if (notif) {
      notif.isRead = true
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  }

  async function markAllRead() {
    await notificationApi.markAllRead()
    notifications.value.forEach((n) => (n.isRead = true))
    unreadCount.value = 0
  }

  return { notifications, unreadCount, loading, fetchUnreadCount, fetchNotifications, markRead, markAllRead }
})
