<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'

const store = useNotificationStore()
const router = useRouter()
const open = ref(false)

defineExpose({ toggle: () => { open.value = !open.value } })

onMounted(() => {
  store.fetchNotifications()
})

function handleClick(id: string, deepLink: string) {
  store.markRead(id)
  open.value = false
  router.push(deepLink)
}
</script>

<template>
  <div v-if="open" class="absolute top-12 right-0 w-80 max-h-96 overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl z-50">
    <div class="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-700">
      <h3 class="text-sm font-medium text-zinc-800 dark:text-zinc-100">Notifications</h3>
      <button
        v-if="store.unreadCount > 0"
        class="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
        @click="store.markAllRead()"
      >
        Mark all read
      </button>
    </div>
    <div v-if="store.notifications.length" class="divide-y divide-zinc-100 dark:divide-zinc-700">
      <button
        v-for="notif in store.notifications"
        :key="notif.id"
        class="w-full text-left p-3 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
        :class="{ 'opacity-60': notif.isRead }"
        @click="handleClick(notif.id, notif.deepLink)"
      >
        <p class="text-xs font-medium text-zinc-700 dark:text-zinc-300">{{ notif.title }}</p>
        <p class="text-[10px] text-zinc-400 mt-0.5">{{ notif.message }}</p>
      </button>
    </div>
    <div v-else class="p-6 text-center text-xs text-zinc-400">No notifications</div>
  </div>
</template>
