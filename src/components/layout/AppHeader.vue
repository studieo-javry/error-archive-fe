<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { BellIcon } from '@heroicons/vue/24/outline'
import WorkspaceSelector from '@/components/layout/WorkspaceSelector.vue'
import NotificationCenter from '@/components/layout/NotificationCenter.vue'
import DemoIcon from '@/components/demo/DemoIcon.vue'
import { useNotificationStore } from '@/stores/notificationStore'
import { useAuthStore } from '@/stores/authStore'
import { useTeamStore } from '@/stores/teamStore'
import { useDemoStore } from '@/stores/demoStore'

const store = useNotificationStore()
const authStore = useAuthStore()
const teamStore = useTeamStore()
const demo = useDemoStore()
const route = useRoute()

// 게스트 헤더(목업 feDemoHeader): 워크스페이스 전환 대신 데모 공간 안내 버튼 + 현재 화면 캡션.
const wsName = computed(() => teamStore.currentWorkspace?.name ?? 'Demo workspace')
const ROUTE_LABELS: Record<string, string> = {
  home: 'Home',
  errorList: 'Library',
  errorCreate: 'New Entry',
  errorEdit: 'Edit Entry',
  errorDetail: 'Error case',
  team: 'Members',
  insights: 'Insights',
  profile: 'Profile',
  settings: 'Settings',
  myPublications: 'Publications',
}
const routeLabel = computed(() => ROUTE_LABELS[String(route.name)] ?? '')
const open = ref(false)
const ringing = ref(false)
const wrap = ref<HTMLElement | null>(null)

// Close on any click/tap outside the bell + panel. A document-level listener works regardless of
// z-index/stacking context (the header's `sticky z-10` traps a plain overlay inside its own context).
function onDocPointerDown(e: PointerEvent) {
  if (wrap.value && !wrap.value.contains(e.target as Node)) open.value = false
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
watch(open, (isOpen) => {
  if (isOpen) {
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

// Replay the bell shake on every new arrival.
watch(() => store.ringSignal, () => {
  ringing.value = false
  requestAnimationFrame(() => { ringing.value = true })
  setTimeout(() => { ringing.value = false }, 650)
})
</script>

<template>
  <div v-if="authStore.isGuest" class="demo-ui relative z-30">
    <header class="header">
      <div class="context">
        <button type="button" class="workspace" aria-haspopup="dialog" @click="demo.openDialog('workspace')">
          <span class="workspace-mark">{{ wsName.charAt(0).toUpperCase() }}</span><span>{{ wsName }}</span><DemoIcon name="down" />
        </button>
        <span v-if="routeLabel" class="context-caption">{{ routeLabel }}</span>
      </div>
      <div class="header-end">
        <span class="guest-caption">Guest session</span>
        <div ref="wrap" class="relative">
          <button
            type="button"
            class="icon-btn"
            :class="{ 'notice-dot': store.unreadCount > 0, 'bell-ring': ringing }"
            aria-label="Notifications"
            :aria-expanded="open"
            @click="open = !open"
          >
            <DemoIcon name="bell" />
          </button>
          <NotificationCenter v-if="open" @close="open = false" />
        </div>
      </div>
    </header>
  </div>

  <!-- z-30: the header owns overlays (notification panel), so it must stack above page content -->
  <header v-else class="glass sticky top-0 z-30 px-6 py-3 flex items-center justify-between">
    <WorkspaceSelector class="shrink-0" />

    <div ref="wrap" class="relative">
      <button
        class="relative p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label="Notifications"
        :aria-expanded="open"
        @click="open = !open"
      >
        <BellIcon class="w-5 h-5 text-zinc-500 dark:text-zinc-400" :class="{ 'bell-ring': ringing }" />
        <span
          v-if="store.unreadCount > 0"
          class="badge-pop absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-emerald-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center"
        >{{ store.unreadCount > 99 ? '99+' : store.unreadCount }}</span>
      </button>

      <NotificationCenter v-if="open" @close="open = false" />
    </div>
  </header>
</template>

<style scoped>
.bell-ring {
  animation: bell-ring 0.65s cubic-bezier(0.36, 0.07, 0.19, 0.97);
  transform-origin: top center;
}
@keyframes bell-ring {
  0%, 100% { transform: rotate(0); }
  15%, 45%, 75% { transform: rotate(-11deg); }
  30%, 60%, 90% { transform: rotate(11deg); }
}
.badge-pop { animation: badge-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes badge-pop {
  from { transform: scale(0.4); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
