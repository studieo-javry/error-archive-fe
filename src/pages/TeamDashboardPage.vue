<script setup lang="ts">
import { ref, watch } from 'vue'
import axios from 'axios'
import { useTeamStore } from '@/stores/teamStore'
import { teamApi } from '@/services/teamApi'
import type { WorkspaceMember } from '@/types/team'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Modal from '@/components/common/Modal.vue'

const teamStore = useTeamStore()
const members = ref<WorkspaceMember[]>([])
const loading = ref(false)
const showInviteModal = ref(false)
const inviteRole = ref('WRITE')
const inviteLink = ref('')
const inviteError = ref('')

// axios 에러 → 사용자에게 보여줄 메시지(BE ProblemDetail 의 detail 우선).
function errorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { detail?: string; message?: string } | undefined
    return data?.detail ?? data?.message ?? fallback
  }
  return fallback
}

async function loadMembers(wsId: number) {
  loading.value = true
  try {
    const { data } = await teamApi.getMembers(wsId)
    members.value = data
  } finally {
    loading.value = false
  }
}

async function createInvite() {
  const wsId = teamStore.currentWorkspaceId
  if (wsId == null) return
  inviteError.value = ''
  inviteLink.value = ''
  try {
    const { data } = await teamApi.createInvitation(wsId, { type: 'LINK', role: inviteRole.value, expiresInHours: 168 })
    if (data.inviteUrl) {
      inviteLink.value = data.inviteUrl
    } else if (data.inviteToken) {
      inviteLink.value = `${window.location.origin}/invite/${data.inviteToken}`
    }
  } catch (e) {
    // 예: ADMIN 은 초대로 부여 불가(가입 후 승격) → BE 400. 조용히 실패하지 않도록 표시.
    inviteError.value = errorMessage(e, '초대 링크 생성에 실패했습니다. 잠시 후 다시 시도해주세요.')
  }
}

async function changeRole(userId: number, role: string) {
  const wsId = teamStore.currentWorkspaceId
  if (wsId == null) return
  await teamApi.changeMemberRole(wsId, userId, role)
  await loadMembers(wsId)
}

// Members of the workspace selected in the header selector.
watch(
  () => teamStore.currentWorkspaceId,
  (id) => {
    if (id != null) loadMembers(id)
    else members.value = []
  },
  { immediate: true },
)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100">
        {{ teamStore.currentWorkspace?.name ?? 'Members' }}
      </h1>
      <button
        v-if="teamStore.currentWorkspaceId != null"
        class="px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        @click="showInviteModal = true"
      >
        Invite Member
      </button>
    </div>

    <p
      v-if="teamStore.currentWorkspaceId == null"
      class="text-sm text-zinc-400 dark:text-zinc-500 py-16 text-center"
    >
      Select a team workspace from the header to view its members.
    </p>

    <LoadingSpinner v-else-if="loading" size="lg" />

    <div v-else class="space-y-3">
      <div
        v-for="member in members"
        :key="member.userId"
        class="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40"
      >
        <div class="flex items-center gap-3">
          <img v-if="member.avatarUrl" :src="member.avatarUrl" :alt="member.displayName" class="w-8 h-8 rounded-full" />
          <div>
            <p class="text-sm font-medium text-zinc-800 dark:text-zinc-100">{{ member.displayName }}</p>
            <p class="text-xs text-zinc-400 dark:text-zinc-500">{{ member.role }}</p>
          </div>
        </div>
        <select
          :value="member.role"
          class="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1 dark:text-zinc-300"
          @change="changeRole(member.userId, ($event.target as HTMLSelectElement).value)"
        >
          <option value="ADMIN">Admin</option>
          <option value="WRITE">Write</option>
          <option value="READ">Read</option>
        </select>
      </div>
    </div>

    <Modal :show="showInviteModal" title="Invite Member" @close="showInviteModal = false">
      <div class="space-y-4">
        <div>
          <select v-model="inviteRole" class="raw-input w-full text-sm" @change="inviteError = ''">
            <option value="WRITE">Write</option>
            <option value="READ">Read</option>
          </select>
          <p class="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
            관리자(Admin) 권한은 초대 링크로 부여할 수 없어요. 멤버가 참여한 뒤 역할을 Admin 으로 변경하세요.
          </p>
        </div>
        <button
          class="w-full px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          @click="createInvite"
        >
          Generate Link
        </button>
        <div v-if="inviteError" class="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50">
          <p class="text-sm text-rose-600 dark:text-rose-400">{{ inviteError }}</p>
        </div>
        <div v-if="inviteLink" class="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-700">
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Share this link:</p>
          <p class="text-sm font-mono text-zinc-800 dark:text-zinc-200 break-all">{{ inviteLink }}</p>
        </div>
      </div>
    </Modal>
  </div>
</template>
