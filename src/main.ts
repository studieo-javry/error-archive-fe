import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './app.css'
import './styles/demo-ui.css'

async function bootstrap() {
  // Inlined on purpose: a function call here would hide the constant from Rollup, keeping the
  // MSW chunk (440 kB) in production builds. Written this way the branch folds away entirely.
  if (import.meta.env.VITE_OFFLINE_MODE === 'true') {
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
    } catch {
      // Stale / invalid token (e.g. the backend user was removed). Drop it so the router
      // treats us as logged out and renders the public landing instead of bouncing to /login.
      authStore.logout()
    }
  }
}

bootstrap()
