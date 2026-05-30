import { onMounted, onUnmounted } from 'vue'
import { useNotificationStore } from '@/stores/notificationStore'
import { useAuthStore } from '@/stores/authStore'

export function useNotification() {
  const store = useNotificationStore()
  const authStore = useAuthStore()
  let interval: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    if (!authStore.isAuthenticated) return
    store.fetchUnreadCount()
    interval = setInterval(() => {
      store.fetchUnreadCount()
    }, 30000)
  }

  function stopPolling() {
    if (interval) {
      clearInterval(interval)
      interval = null
    }
  }

  onMounted(startPolling)
  onUnmounted(stopPolling)

  return { store, startPolling, stopPolling }
}
