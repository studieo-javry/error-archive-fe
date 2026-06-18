import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const routes = [
  { path: '/', name: 'landing', component: () => import('@/pages/LandingPage.vue'), meta: { public: true, fullScreen: true } },
  { path: '/home', name: 'home', component: () => import('@/pages/HomePage.vue') },
  { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { public: true } },
  { path: '/auth/callback', name: 'authCallback', component: () => import('@/pages/AuthCallbackPage.vue'), meta: { public: true } },
  { path: '/errors', name: 'errorList', component: () => import('@/pages/ErrorListPage.vue') },
  { path: '/errors/new', name: 'errorCreate', component: () => import('@/pages/ErrorFormPage.vue') },
  { path: '/errors/:id', name: 'errorDetail', component: () => import('@/pages/ErrorDetailPage.vue') },
  { path: '/errors/:id/edit', name: 'errorEdit', component: () => import('@/pages/ErrorFormPage.vue') },
  { path: '/search', name: 'search', component: () => import('@/pages/SearchPage.vue') },
  { path: '/team', name: 'team', component: () => import('@/pages/TeamDashboardPage.vue') },
  { path: '/insights', name: 'insights', component: () => import('@/pages/InsightPage.vue') },
  { path: '/profile/:id?', name: 'profile', component: () => import('@/pages/ProfilePage.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/pages/SettingsPage.vue'), meta: { wideLayout: true } },
  { path: '/report/:shareToken', name: 'report', component: () => import('@/pages/ReportPage.vue'), meta: { public: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  if (!to.meta.public && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
})

export default router
