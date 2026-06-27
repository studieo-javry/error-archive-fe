import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './app.css'

function isOfflineMode() {
  return import.meta.env.VITE_OFFLINE_MODE === 'true'
}

async function bootstrap() {
  if (isOfflineMode()) {
    const { worker } = await import('../mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })

    if (!localStorage.getItem('accessToken')) {
      localStorage.setItem('accessToken', 'mock-access-token')
    }
  }

  const pinia = createPinia()
  const app = createApp(App)
  app.use(pinia)
  app.use(router)
  app.mount('#app')

  // Restore the signed-in user's profile on startup whenever a token exists (both modes),
  // so the sidebar avatar and other profile-dependent UI render after a refresh.
  if (localStorage.getItem('accessToken')) {
    const { useAuthStore } = await import('@/stores/authStore')
    const { authApi } = await import('@/services/authApi')
    const authStore = useAuthStore()
    authStore.setAccessToken(localStorage.getItem('accessToken')!)
    try {
      const { data } = await authApi.getMe()
      authStore.setUser(data)
    } catch { /* not authenticated or backend unavailable */ }
  }
}

bootstrap()
