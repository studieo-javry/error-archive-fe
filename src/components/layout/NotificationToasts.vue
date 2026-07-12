<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'
import { useTeamStore } from '@/stores/teamStore'
import { notificationMeta, notificationTitle, notificationSnippet, notificationRoute } from '@/utils/notificationView'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import type { AppNotification } from '@/types/notification'

const store = useNotificationStore()
const router = useRouter()
const teamStore = useTeamStore()

const timers = new Map<number, ReturnType<typeof setTimeout>>()

// Auto-dismiss each toast ~5s after it appears.
watch(
  () => store.toasts.map(t => t.key),
  (keys) => {
    keys.forEach(k => {
      if (!timers.has(k)) timers.set(k, setTimeout(() => dismiss(k), 5200))
    })
    for (const k of timers.keys()) {
      if (!keys.includes(k)) { clearTimeout(timers.get(k)!); timers.delete(k) }
    }
  },
  { deep: true },
)

function dismiss(key: number) {
  store.dismissToast(key)
}

function onClick(key: number, n: AppNotification) {
  store.markRead(n.id)
  dismiss(key)
  const route = notificationRoute(n.deepLink, teamStore.currentSlug)
  if (route) router.push(route)
}
</script>

<template>
  <div class="fixed top-4 right-4 z-[60] flex flex-col gap-2.5 w-[340px] pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="t in store.toasts"
        :key="t.key"
        class="toast-card pointer-events-auto relative overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-700/70 bg-white dark:bg-zinc-900 shadow-lg shadow-zinc-900/10 cursor-pointer"
        @click="onClick(t.key, t.notification)"
      >
        <div class="flex items-start gap-3 pl-4 pr-8 py-3">
          <component :is="notificationMeta(t.notification.type).icon" class="w-4 h-4 mt-0.5 shrink-0" :class="notificationMeta(t.notification.type).tone" />
          <div class="flex-1 min-w-0">
            <p class="text-[13px] font-medium text-zinc-800 dark:text-zinc-100">{{ notificationTitle(t.notification) }}</p>
            <p v-if="notificationSnippet(t.notification)" class="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{{ notificationSnippet(t.notification) }}</p>
          </div>
        </div>
        <button
          class="absolute top-2 right-2 p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Dismiss"
          @click.stop="dismiss(t.key)"
        >
          <XMarkIcon class="w-3.5 h-3.5" />
        </button>
        <!-- thin progress line -->
        <span class="toast-bar absolute bottom-0 left-0 h-0.5 bg-emerald-500" />
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-from { opacity: 0; transform: translateX(24px); }
.toast-enter-active { transition: opacity 0.32s cubic-bezier(0.21, 1.02, 0.55, 1), transform 0.32s cubic-bezier(0.21, 1.02, 0.55, 1); }
.toast-leave-to { opacity: 0; transform: translateX(24px); }
.toast-leave-active { transition: opacity 0.22s ease, transform 0.22s ease; position: absolute; width: 100%; }

.toast-bar {
  width: 100%;
  transform-origin: left;
  animation: toast-bar 5.2s linear forwards;
}
@keyframes toast-bar {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}
</style>
