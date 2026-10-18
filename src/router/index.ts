import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useTeamStore } from '@/stores/teamStore'

const routes = [
  { path: '/', name: 'landing', component: () => import('@/pages/LandingPage.vue'), meta: { public: true, fullScreen: true } },
  { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { public: true } },
  { path: '/auth/callback', name: 'authCallback', component: () => import('@/pages/AuthCallbackPage.vue'), meta: { public: true } },

  // Workspace-scoped routes — the workspace slug is carried in the URL (/w/:slug/...).
  { path: '/w/:slug/home', name: 'home', component: () => import('@/pages/HomePage.vue') },
  { path: '/w/:slug/errors', name: 'errorList', component: () => import('@/pages/ErrorListPage.vue') },
  { path: '/w/:slug/errors/new', name: 'errorCreate', component: () => import('@/pages/ErrorFormPage.vue') },
  { path: '/w/:slug/errors/:id', name: 'errorDetail', component: () => import('@/pages/ErrorDetailPage.vue') },
  { path: '/w/:slug/errors/:id/edit', name: 'errorEdit', component: () => import('@/pages/ErrorFormPage.vue') },
  { path: '/w/:slug/search', name: 'search', component: () => import('@/pages/SearchPage.vue') },
  { path: '/w/:slug/insights', name: 'insights', component: () => import('@/pages/InsightPage.vue') },
  { path: '/w/:slug/members', name: 'team', component: () => import('@/pages/TeamDashboardPage.vue') },

  // Global routes — shared across all workspaces.
  // Explore = 공개 발행물 탐색(둘러보기/쇼케이스). 워크스페이스 무관 전역 — Profile/Settings 와 동급.
  { path: '/explore', name: 'explore', component: () => import('@/pages/ExplorePage.vue') },
  { path: '/profile/:id?', name: 'profile', component: () => import('@/pages/ProfilePage.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/pages/SettingsPage.vue'), meta: { wideLayout: true } },
  { path: '/report/:shareToken', name: 'report', component: () => import('@/pages/ReportPage.vue'), meta: { public: true } },

  // Workspace invitation accept — the email/link target is `${INVITE_BASE}/{token}`. Requires
  // auth (no meta.public): the guard bounces logged-out users to login?redirect=/invitations/{token}
  // and they return here after OAuth, so the page always renders authenticated and can accept.
  { path: '/invitations/:token', name: 'invite', component: () => import('@/pages/InvitePage.vue') },

  // Legacy path redirects → public workspace.
  { path: '/home', redirect: '/w/public/home' },
  { path: '/errors', redirect: '/w/public/errors' },
  { path: '/errors/new', redirect: '/w/public/errors/new' },
  { path: '/search', redirect: '/w/public/search' },
  { path: '/insights', redirect: '/w/public/insights' },
  { path: '/team', redirect: '/w/public/members' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (!to.meta.public && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  // Sync the current workspace from the URL slug on workspace-scoped routes.
  const slug = to.params.slug as string | undefined
  if (slug) {
    await useTeamStore().resolveSlug(slug)
  }
})

export default router
