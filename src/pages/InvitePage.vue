<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'
import { teamApi } from '@/services/teamApi'
import { useTeamStore } from '@/stores/teamStore'
import type { InvitationPreview } from '@/types/team'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

const route = useRoute()
const router = useRouter()
const teamStore = useTeamStore()

const token = String(route.params.token)
const preview = ref<InvitationPreview | null>(null)
const loading = ref(true)
const accepting = ref(false)
const error = ref('')

function errorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { detail?: string; message?: string } | undefined
    return data?.detail ?? data?.message ?? fallback
  }
  return fallback
}

const roleLabel: Record<string, string> = { ADMIN: 'Admin', WRITE: 'Write', READ: 'Read' }

onMounted(async () => {
  try {
    const { data } = await teamApi.previewInvitation(token)
    preview.value = data
  } catch (e) {
    error.value = errorMessage(e, '초대 정보를 불러오지 못했습니다. 링크가 만료되었거나 취소되었을 수 있어요.')
  } finally {
    loading.value = false
  }
})

async function accept() {
  if (accepting.value) return
  accepting.value = true
  error.value = ''
  try {
    const { data } = await teamApi.acceptInvitation(token)
    // 새 워크스페이스가 선택기/사이드바에 즉시 뜨도록 목록 재조회 후 현재 워크스페이스로 지정.
    await teamStore.fetchWorkspaces()
    teamStore.setCurrentWorkspace(data.workspaceId)
    router.replace({ name: 'home', params: { slug: data.slug } })
  } catch (e) {
    error.value = errorMessage(e, '초대 수락에 실패했습니다. 링크가 만료되었거나 이미 사용되었을 수 있어요.')
    accepting.value = false
  }
}

function goHome() {
  router.replace({ name: 'home', params: { slug: teamStore.currentSlug } })
}
</script>

<template>
  <div class="max-w-md mx-auto py-20 px-4">
    <LoadingSpinner v-if="loading" size="lg" />

    <!-- error / invalid / expired -->
    <div
      v-else-if="error"
      class="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 p-8 text-center"
    >
      <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-500 text-xl">!</div>
      <h1 class="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-2">초대를 사용할 수 없어요</h1>
      <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{{ error }}</p>
      <button class="px-4 py-2 text-sm font-medium rounded-xl bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors" @click="goHome">
        홈으로
      </button>
    </div>

    <!-- preview + accept -->
    <div
      v-else-if="preview"
      class="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 p-8 text-center"
    >
      <p class="text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-medium mb-3">Workspace invitation</p>
      <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100 mb-2">{{ preview.workspaceName }}</h1>
      <p class="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        <span class="font-medium text-zinc-700 dark:text-zinc-200">{{ roleLabel[preview.role] ?? preview.role }}</span> 권한으로 이 워크스페이스에 초대되었어요.
      </p>

      <button
        v-if="preview.usable"
        class="w-full px-4 py-2.5 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
        :disabled="accepting"
        @click="accept"
      >
        {{ accepting ? '참여하는 중…' : '초대 수락하고 참여하기' }}
      </button>
      <p v-else class="text-sm text-rose-500 dark:text-rose-400">이 초대는 만료되었거나 이미 사용/취소되었어요.</p>

      <button
        class="mt-4 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        @click="goHome"
      >
        나중에 하기
      </button>
    </div>
  </div>
</template>
