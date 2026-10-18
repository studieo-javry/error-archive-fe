<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Component } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { useAuth } from '@/composables/useAuth'
import { useTeamStore } from '@/stores/teamStore'
import { useAuthStore } from '@/stores/authStore'
import {
  HomeIcon,
  BookOpenIcon,
  GlobeAltIcon,
  PlusCircleIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  UserGroupIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const { isDark, toggle } = useTheme()
const { logout } = useAuth()
const teamStore = useTeamStore()
const authStore = useAuthStore()

// `global` 항목은 워크스페이스 슬러그를 받지 않는 전역 라우트(Explore 등) — 슬러그 param 을 붙이지 않는다.
type NavItem = { name: string; icon: Component; global?: boolean }

// Menus differ by space: Public has the community Search; a team has Members instead
// (a team's Library already shows all of the team's cases). Workspace items are slug-scoped;
// Explore 는 전역(공개 발행물 탐색) 이라 slug 무관.
const navItems = computed<NavItem[]>(() => {
  const isTeam = teamStore.currentWorkspaceId !== null
  return [
    { name: 'home', icon: HomeIcon },
    { name: 'errorList', icon: BookOpenIcon },
    { name: 'explore', icon: GlobeAltIcon, global: true },
    { name: 'errorCreate', icon: PlusCircleIcon },
    isTeam
      ? { name: 'team', icon: UserGroupIcon }
      : { name: 'search', icon: MagnifyingGlassIcon },
    { name: 'insights', icon: ChartBarIcon },
  ]
})

function targetFor(item: NavItem) {
  return item.global ? { name: item.name } : { name: item.name, params: { slug: teamStore.currentSlug } }
}

function isActive(item: NavItem) {
  return route.name === item.name
}

// Account menu (global, shared across workspaces).
const menuOpen = ref(false)
const menuWrap = ref<HTMLElement | null>(null)

// Close on outside click via a document listener rather than a full-viewport overlay —
// an overlay would also swallow wheel events and freeze scrolling behind the menu.
function onDocPointerDown(e: PointerEvent) {
  if (menuWrap.value && !menuWrap.value.contains(e.target as Node)) menuOpen.value = false
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') menuOpen.value = false
}
watch(menuOpen, (open) => {
  if (open) {
    document.addEventListener('pointerdown', onDocPointerDown)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('pointerdown', onDocPointerDown)
    document.removeEventListener('keydown', onKeydown)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
function goProfile() {
  menuOpen.value = false
  router.push({ name: 'profile' })
}
function goSettings() {
  menuOpen.value = false
  router.push({ name: 'settings' })
}
async function onLogout() {
  menuOpen.value = false
  await logout()
}
</script>

<template>
  <nav class="w-20 bg-white border-r border-zinc-200 flex flex-col items-center py-8 z-20 flex-shrink-0 dark:bg-zinc-900 dark:border-zinc-800 transition-colors">
    <div class="mb-10 text-emerald-500 text-2xl font-bold serif-title">E</div>
    <div class="space-y-4 flex flex-col items-center w-full flex-1">
      <router-link
        v-for="item in navItems"
        :key="item.name"
        :to="targetFor(item)"
        class="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
        :class="isActive(item)
          ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950'
          : 'text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'"
      >
        <component :is="item.icon" class="w-5 h-5" />
      </router-link>
    </div>

    <!-- Account menu: profile / settings / theme (global, shared across workspaces) -->
    <div ref="menuWrap" class="relative">
      <button
        class="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 hover:ring-2 hover:ring-emerald-400 transition"
        aria-label="Account menu"
        :aria-expanded="menuOpen"
        @click="menuOpen = !menuOpen"
      >
        <img
          v-if="authStore.user?.avatarUrl"
          :src="authStore.user.avatarUrl"
          :alt="authStore.user.displayName"
          class="w-full h-full object-cover"
        />
        <span v-else class="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          {{ (authStore.user?.displayName ?? '?').charAt(0).toUpperCase() }}
        </span>
      </button>

      <div
        v-if="menuOpen"
        role="menu"
        class="absolute left-12 bottom-0 w-44 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl z-50 py-1.5"
      >
        <button role="menuitem" class="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors" @click="goProfile">
          <UserCircleIcon class="w-4 h-4 text-zinc-400" />
          Profile
        </button>
        <button role="menuitem" class="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors" @click="goSettings">
          <Cog6ToothIcon class="w-4 h-4 text-zinc-400" />
          Settings
        </button>
        <button role="menuitem" class="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors" @click="onLogout">
          <ArrowRightOnRectangleIcon class="w-4 h-4 text-zinc-400" />
          Logout
        </button>

        <div class="border-t border-zinc-100 dark:border-zinc-700 my-1" />

        <button role="menuitem" class="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors" @click="toggle">
          <component :is="isDark ? SunIcon : MoonIcon" class="w-4 h-4 text-zinc-400" />
          {{ isDark ? 'Light mode' : 'Dark mode' }}
        </button>
      </div>
    </div>
  </nav>
</template>
