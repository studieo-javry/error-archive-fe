<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppHeader from '@/components/layout/AppHeader.vue'

useTheme()

const route = useRoute()
const isFullScreen = computed(() => !!route.meta.fullScreen)
const isWideLayout = computed(() => !!route.meta.wideLayout)
</script>

<template>
  <router-view v-if="isFullScreen" />
  <div v-else class="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-[#18181b] dark:text-[#e4e4e7]">
    <AppSidebar />
    <div class="flex-1 flex flex-col overflow-hidden">
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
  </div>
</template>
