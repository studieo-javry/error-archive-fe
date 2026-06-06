<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { authApi } from '@/services/authApi'
import { notificationApi } from '@/services/notificationApi'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/composables/useAuth'
import type { NotificationSettings } from '@/types/notification'

const authStore = useAuthStore()
const { logout } = useAuth()
const displayName = ref('')
const bio = ref('')
const notifSettings = ref<NotificationSettings>({ comment: true, reaction: true, invitation: true, follow: true, watchUpdate: true })
const saving = ref(false)

onMounted(async () => {
  if (authStore.user) {
    displayName.value = authStore.user.displayName
    bio.value = authStore.user.bio ?? ''
  }
  try {
    const { data } = await notificationApi.getSettings()
    notifSettings.value = data
  } catch { /* use defaults */ }
})

async function saveProfile() {
  saving.value = true
  try {
    const { data } = await authApi.updateProfile({ displayName: displayName.value, bio: bio.value })
    authStore.setUser(data)
  } finally {
    saving.value = false
  }
}

async function saveNotifSettings() {
  await notificationApi.updateSettings(notifSettings.value)
}
</script>

<template>
  <div class="max-w-xl mx-auto">
    <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100 mb-6">Settings</h1>

    <section class="mb-8">
      <h2 class="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">Profile</h2>
      <div class="space-y-4">
        <input v-model="displayName" placeholder="Display Name" class="raw-input w-full text-sm" />
        <textarea v-model="bio" placeholder="Bio" rows="3" class="raw-textarea w-full" />
        <button
          class="px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          :disabled="saving"
          @click="saveProfile"
        >
          {{ saving ? 'Saving...' : 'Save Profile' }}
        </button>
      </div>
    </section>

    <section class="mb-8">
      <h2 class="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">Notifications</h2>
      <div class="space-y-3">
        <label v-for="(_value, key) in notifSettings" :key="key" class="flex items-center justify-between">
          <span class="text-sm text-zinc-600 dark:text-zinc-400 capitalize">{{ key.replace(/([A-Z])/g, ' $1') }}</span>
          <input
            v-model="notifSettings[key as keyof NotificationSettings]"
            type="checkbox"
            class="custom-checkbox"
            @change="saveNotifSettings"
          />
        </label>
      </div>
    </section>

    <section>
      <button
        class="px-4 py-2 text-sm font-medium rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 transition-colors"
        @click="logout"
      >
        Sign Out
      </button>
    </section>
  </div>
</template>
