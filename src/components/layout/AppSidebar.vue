<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import {
  HomeIcon,
  BookOpenIcon,
  PlusCircleIcon,
  UserGroupIcon,
  UserIcon,
  ChartBarIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/vue/24/outline'

const route = useRoute()
const { isDark, toggle } = useTheme()

const navItems = [
  { name: 'home', icon: HomeIcon, path: '/home' },
  { name: 'errorList', icon: BookOpenIcon, path: '/errors' },
  { name: 'errorCreate', icon: PlusCircleIcon, path: '/errors/new' },
  { name: 'team', icon: UserGroupIcon, path: '/team' },
  { name: 'insights', icon: ChartBarIcon, path: '/insights' },
  { name: 'profile', icon: UserIcon, path: '/profile' },
]

function isActive(item: { name: string; path: string }) {
  if (item.path === '/home') return route.path === '/home'
  return route.path.startsWith(item.path)
}
</script>

<template>
  <nav class="w-20 bg-white border-r border-zinc-200 flex flex-col items-center py-8 z-20 flex-shrink-0 dark:bg-zinc-900 dark:border-zinc-800 transition-colors">
    <div class="mb-10 text-emerald-500 text-2xl font-bold serif-title">E</div>
    <div class="space-y-4 flex flex-col items-center w-full flex-1">
      <router-link
        v-for="item in navItems"
        :key="item.name"
        :to="item.path"
        class="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
        :class="isActive(item)
          ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950'
          : 'text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'"
      >
        <component :is="item.icon" class="w-5 h-5" />
      </router-link>
    </div>
    <button
      class="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
      @click="toggle"
    >
      <MoonIcon v-if="!isDark" class="w-5 h-5" />
      <SunIcon v-else class="w-5 h-5" />
    </button>
  </nav>
</template>
