<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import DemoBanner from '@/components/layout/DemoBanner.vue'
import GuestExpiryOverlay from '@/components/layout/GuestExpiryOverlay.vue'
import NotificationToasts from '@/components/layout/NotificationToasts.vue'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'

useTheme()

// Open/close the realtime notification stream with the auth session.
const authStore = useAuthStore()
const notificationStore = useNotificationStore()
watch(
  () => authStore.isAuthenticated,
  (authed) => { authed ? notificationStore.connect() : notificationStore.disconnect() },
  { immediate: true },
)

const route = useRoute()
const isFullScreen = computed(() => !!route.meta.fullScreen)
const isWideLayout = computed(() => !!route.meta.wideLayout)
// Public, pre-auth pages (login / OAuth callback / shared report) render WITHOUT the app chrome.
// The sidebar/header eagerly call authenticated APIs (e.g. /workspaces), which 401 while logged
// out — so they must not mount on public routes.
const isPublic = computed(() => !!route.meta.public)
// optionalAuth 라우트(예: /explore)를 로그아웃으로 열면 사이드바/헤더 없이 chrome-less 로 — 그 페이지가
// 자체 헤더를 그린다. 로그인 상태면 아래 일반 레이아웃(사이드바)로 떨어져 페이지는 피드만 렌더한다.
const isOptionalLoggedOut = computed(() => !!route.meta.optionalAuth && !authStore.isAuthenticated)
const isChromeless = computed(() => isPublic.value || isOptionalLoggedOut.value)
</script>

<template>
  <router-view v-if="isFullScreen" />
  <div v-else-if="isChromeless" class="min-h-screen bg-[#f7f7f5] text-zinc-900 dark:bg-[#18181b] dark:text-[#e4e4e7]">
    <router-view />
  </div>
  <div v-else class="flex h-screen overflow-hidden bg-[#f7f7f5] text-zinc-900 dark:bg-[#18181b] dark:text-[#e4e4e7]">
    <AppSidebar />
    <div class="flex-1 flex flex-col overflow-hidden">
      <DemoBanner v-if="authStore.isGuest" />
      <AppHeader />
      <main class="flex-1 overflow-y-auto">
        <div v-if="isWideLayout" class="h-full p-6">
          <router-view />
        </div>
        <div v-else class="max-w-5xl mx-auto p-10 pb-32">
          <router-view />
        </div>
      </main>
    </div>
    <NotificationToasts />
    <GuestExpiryOverlay v-if="authStore.isGuest" />
  </div>
</template>
