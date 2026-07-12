<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'
import { useTeamStore } from '@/stores/teamStore'
import { notificationMeta, notificationTitle, notificationSnippet, notificationRoute } from '@/utils/notificationView'
import { timeAgo } from '@/utils/timeAgo'
import type { AppNotification } from '@/types/notification'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const emit = defineEmits<{ close: [] }>()

const store = useNotificationStore()
const router = useRouter()
const teamStore = useTeamStore()

const tab = ref<'all' | 'unread'>('all')
const shown = computed(() =>
  tab.value === 'unread' ? store.notifications.filter(n => !n.readAt) : store.notifications,
)

onMounted(() => { store.fetchNotifications() })

function onItem(n: AppNotification) {
  store.markRead(n.id)
  const route = notificationRoute(n.deepLink, teamStore.currentSlug)
  emit('close')
  if (route) router.push(route)
}
</script>

<template>
  <div class="absolute top-11 right-0 w-[360px] rounded-2xl border border-zinc-200/80 dark:border-zinc-700/70 bg-white dark:bg-zinc-900 shadow-lg shadow-zinc-900/5 z-50 overflow-hidden">
    <!-- header -->
    <div class="flex items-center justify-between px-4 h-12">
      <h3 class="text-sm font-medium text-zinc-800 dark:text-zinc-100">Notifications</h3>
      <button
        v-if="store.unreadCount > 0"
        class="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors"
        @click="store.markAllRead()"
      >Mark all read</button>
    </div>

    <!-- tabs (underline, line-based) -->
    <div class="flex items-center gap-5 px-4 border-b border-zinc-100 dark:border-zinc-800">
      <button
        v-for="t in (['all', 'unread'] as const)"
        :key="t"
        class="relative -mb-px py-2 text-xs font-medium transition-colors"
        :class="tab === t ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'"
        @click="tab = t"
      >
        {{ t === 'all' ? 'All' : 'Unread' }}
        <span v-if="t === 'unread' && store.unreadCount > 0" class="ml-1 text-emerald-500">{{ store.unreadCount }}</span>
        <span v-if="tab === t" class="absolute left-0 right-0 -bottom-px h-0.5 bg-emerald-500 rounded-full" />
      </button>
    </div>

    <!-- list -->
    <div class="max-h-[380px] overflow-y-auto">
      <LoadingSpinner v-if="store.loading && !store.notifications.length" size="md" class="my-8" />

      <p v-else-if="!shown.length" class="py-10 text-center text-xs text-zinc-400 dark:text-zinc-500">
        {{ tab === 'unread' ? 'No unread notifications' : 'No notifications yet' }}
      </p>

      <ul v-else class="divide-y divide-zinc-100 dark:divide-zinc-800/70">
        <li v-for="n in shown" :key="n.id">
          <button
            type="button"
            class="w-full text-left flex items-start gap-3 border-l-2 pl-[14px] pr-3 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
            :class="n.readAt ? 'border-transparent' : 'border-emerald-500'"
            @click="onItem(n)"
          >
            <component :is="notificationMeta(n.type).icon" class="w-4 h-4 mt-0.5 shrink-0" :class="notificationMeta(n.type).tone" />
            <span class="flex-1 min-w-0">
              <span class="block text-[13px]" :class="n.readAt ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-900 dark:text-white font-semibold'">{{ notificationTitle(n) }}</span>
              <span v-if="notificationSnippet(n)" class="block text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{{ notificationSnippet(n) }}</span>
              <span class="block text-[11px] text-zinc-400 dark:text-zinc-600 mt-1">{{ timeAgo(n.createdAt) }}</span>
            </span>
            <span v-if="!n.readAt" class="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
