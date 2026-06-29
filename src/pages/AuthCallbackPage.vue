<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const route = useRoute()
const router = useRouter()
const { handleCallback } = useAuth()
const error = ref<string | null>(null)

onMounted(async () => {
  const code = route.query.code as string
  const state = route.query.state as string
  const errorParam = route.query.error as string

  if (errorParam) {
    error.value = `GitHub authorization failed: ${errorParam}`
    return
  }

  if (!code || !state) {
    error.value = 'Missing authorization code or state'
    return
  }

  try {
    await handleCallback(code, state)
  } catch {
    error.value = 'Login failed. Please try again.'
  }
})
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen gap-4">
    <template v-if="error">
      <div class="text-center">
        <p class="text-sm text-rose-500 mb-4">{{ error }}</p>
        <button
          class="px-4 py-2 text-sm font-medium rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 transition-colors"
          @click="router.push('/login')"
        >
          Back to Login
        </button>
      </div>
    </template>
    <template v-else>
      <LoadingSpinner size="lg" />
      <p class="text-sm text-zinc-500 dark:text-zinc-400">Authenticating...</p>
    </template>
  </div>
</template>
