import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useTeamStore, PUBLIC_SLUG } from '@/stores/teamStore'
import { useDemoStore } from '@/stores/demoStore'

const routes = [
  { path: '/', name: 'landing', component: () => import('@/pages/LandingPage.vue'), meta: { public: true, fullScreen: true } },
  { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { public: true } },
  { path: '/auth/callback', name: 'authCallback', component: () => import('@/pages/AuthCallbackPage.vue'), meta: { public: true } },

  // Workspace-scoped routes — the workspace slug is carried in the URL (/w/:slug/...).
  { path: '/w/:slug/home', name: 'home', component: () => import('@/pages/HomePage.vue') },
  { path: '/w/:slug/errors', name: 'errorList', component: () => import('@/pages/ErrorListPage.vue') },
  { path: '/w/:slug/errors/new', name: 'errorCreate', component: () => import('@/pages/ErrorFormPage.vue'), meta: { wideLayout: true } },
  { path: '/w/:slug/errors/:id', name: 'errorDetail', component: () => import('@/pages/ErrorDetailPage.vue') },
  { path: '/w/:slug/errors/:id/edit', name: 'errorEdit', component: () => import('@/pages/ErrorFormPage.vue') },
  { path: '/w/:slug/search', name: 'search', component: () => import('@/pages/SearchPage.vue') },
  { path: '/w/:slug/insights', name: 'insights', component: () => import('@/pages/InsightPage.vue') },
  { path: '/w/:slug/members', name: 'team', component: () => import('@/pages/TeamDashboardPage.vue') },

  // Global routes — shared across all workspaces.
  // Explore = 공개 발행물 탐색(둘러보기/쇼케이스). 워크스페이스 무관 전역 — Profile/Settings 와 동급.
  // optionalAuth: 로그아웃도 접근(랜딩/SEO/데모). 로그인 시엔 앱 chrome(사이드바) 안에서, 로그아웃 시엔
  // ExplorePage 자체 헤더로 chrome-less 렌더(App.vue 가 레이아웃 분기).
  { path: '/explore', name: 'explore', component: () => import('@/pages/ExplorePage.vue'), meta: { optionalAuth: true } },
  { path: '/me/publications', name: 'myPublications', component: () => import('@/pages/MyPublicationsPage.vue') },
  { path: '/profile/:id?', name: 'profile', component: () => import('@/pages/ProfilePage.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/pages/SettingsPage.vue'), meta: { wideLayout: true } },
  { path: '/settings/integrations', name: 'settingsIntegrations', component: () => import('@/pages/SettingsPage.vue'), meta: { wideLayout: true } },
  // GitHub App Setup URL — 설치 후 GitHub 가 installation_id·code·state 를 붙여 돌려보낸다(로그인 필요: 비로그인은 login?redirect 로 갔다 복귀).
  { path: '/settings/integrations/github/callback', name: 'githubCallback', component: () => import('@/pages/SettingsPage.vue'), meta: { wideLayout: true } },
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

// 게스트(데모)가 들어갈 수 없는 공개 공간 — 전역 Explore, 커뮤니티 Search, 그리고 /w/public/* 전체.
const PUBLIC_ONLY_ROUTES = new Set(['explore', 'search'])
// 공개 공간 → 데모 워크스페이스로 돌려보낼 때 같은 화면을 유지할 수 있는 라우트(나머진 Home 으로).
const GUEST_PORTABLE_ROUTES = new Set(['home', 'errorList', 'errorCreate', 'insights', 'team'])

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  // optionalAuth 라우트(예: /explore)는 로그아웃도 통과 — 공개 쇼케이스를 비로그인도 열람.
  if (!to.meta.public && !to.meta.optionalAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  const slug = to.params.slug as string | undefined
  if (authStore.isGuest && (PUBLIC_ONLY_ROUTES.has(String(to.name)) || slug === PUBLIC_SLUG)) {
    const teamStore = useTeamStore()
    if (!teamStore.workspaces.length) await teamStore.fetchWorkspaces().catch(() => {})
    const demoSlug = teamStore.workspaces[0]?.slug
    if (demoSlug) {
      useDemoStore().toast('공개 공간(Search · Explore)은 가입 후 이용할 수 있어요.')
      const name = GUEST_PORTABLE_ROUTES.has(String(to.name)) ? String(to.name) : 'home'
      return { name, params: { slug: demoSlug } }
    }
  }
  // Sync the current workspace from the URL slug on workspace-scoped routes.
  if (slug) {
    await useTeamStore().resolveSlug(slug)
  }
})

export default router
