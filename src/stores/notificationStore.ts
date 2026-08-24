import { defineStore } from 'pinia'
import { ref } from 'vue'
import { notificationApi } from '@/services/notificationApi'
import { API_BASE } from '@/services/apiBase'
import { useAuthStore } from '@/stores/authStore'
import type { AppNotification } from '@/types/notification'

interface Toast {
  key: number
  notification: AppNotification
}

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<AppNotification[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const toasts = ref<Toast[]>([])
  const streamConnected = ref(false)
  /** Increments on every new arrival — the bell watches this to replay its shake. */
  const ringSignal = ref(0)

  // Non-reactive connection internals.
  let es: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay = 1000
  let lastFocusFetch = 0
  let toastKey = 0
  let listenersBound = false

  async function fetchUnreadCount() {
    try {
      const { data } = await notificationApi.unreadCount()
      unreadCount.value = data.count
    } catch { /* ignore */ }
  }

  async function fetchNotifications() {
    loading.value = true
    try {
      const { data } = await notificationApi.list({ limit: 30 })
      notifications.value = data
    } finally {
      loading.value = false
    }
  }

  function receiveRealtime(dto: AppNotification) {
    if (notifications.value.some(n => n.id === dto.id)) return // dedup (reconnect replays)
    notifications.value.unshift(dto)
    if (!dto.readAt) unreadCount.value += 1
    toasts.value.push({ key: ++toastKey, notification: dto })
    ringSignal.value += 1
  }

  function dismissToast(key: number) {
    toasts.value = toasts.value.filter(t => t.key !== key)
  }

  async function markRead(id: number) {
    const n = notifications.value.find(x => x.id === id)
    if (n && !n.readAt) {
      n.readAt = new Date().toISOString()
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
    try { await notificationApi.markRead(id) } catch { /* optimistic */ }
  }

  async function markAllRead() {
    notifications.value.forEach(n => { if (!n.readAt) n.readAt = new Date().toISOString() })
    unreadCount.value = 0
    try { await notificationApi.markAllRead() } catch { /* optimistic */ }
  }

  // ── Realtime SSE ──
  function onFocus() {
    if (document.hidden) return
    const now = Date.now()
    if (now - lastFocusFetch < 5000) return // throttle
    lastFocusFetch = now
    fetchUnreadCount()
  }

  async function openStream() {
    try {
      const { data } = await notificationApi.sseTicket()
      // EventSource can't set headers → ticket rides the query string (gateway extracts it).
      es = new EventSource(`${API_BASE}/users/me/notifications/stream?ticket=${encodeURIComponent(data.ticket)}`)
      es.addEventListener('open', () => {
        streamConnected.value = true
        reconnectDelay = 1000
      })
      es.addEventListener('notification', (e: MessageEvent) => {
        try { receiveRealtime(JSON.parse(e.data)) } catch { /* ignore malformed */ }
      })
      es.addEventListener('error', () => {
        // Ticket is short-lived, so the browser's built-in retry would reuse a dead ticket —
        // close and reconnect ourselves with a fresh ticket (capped backoff).
        streamConnected.value = false
        es?.close()
        es = null
        scheduleReconnect()
      })
    } catch {
      scheduleReconnect()
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (!useAuthStore().isAuthenticated) return
      fetchUnreadCount() // reconcile anything missed while disconnected
      openStream()
    }, reconnectDelay)
    reconnectDelay = Math.min(reconnectDelay * 2, 30000)
  }

  function connect() {
    if (!useAuthStore().isAuthenticated || es) return
    if (!listenersBound) {
      window.addEventListener('focus', onFocus)
      document.addEventListener('visibilitychange', onFocus)
      listenersBound = true
    }
    fetchUnreadCount()
    openStream()
  }

  function disconnect() {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    es?.close()
    es = null
    streamConnected.value = false
    if (listenersBound) {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      listenersBound = false
    }
  }

  return {
    notifications, unreadCount, loading, toasts, streamConnected, ringSignal,
    fetchUnreadCount, fetchNotifications, receiveRealtime, dismissToast,
    markRead, markAllRead, connect, disconnect,
  }
})
