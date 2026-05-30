<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTeamStore } from '@/stores/teamStore'
import { teamApi } from '@/services/teamApi'
import type { Member, MemberRole } from '@/types/team'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Modal from '@/components/common/Modal.vue'

const teamStore = useTeamStore()
const members = ref<Member[]>([])
const showInviteModal = ref(false)
const inviteRole = ref<MemberRole>('WRITER')
const inviteLink = ref('')
const selectedWorkspace = ref<string>('')

async function loadMembers(wsId: string) {
  selectedWorkspace.value = wsId
  const { data } = await teamApi.getMembers(wsId)
  members.value = data.data
}

async function createInvite() {
  if (!selectedWorkspace.value) return
  const { data } = await teamApi.createInvitation(selectedWorkspace.value, { role: inviteRole.value, expiresInDays: 7 })
  inviteLink.value = `${window.location.origin}/invite/${data.data.token}`
}

async function changeRole(memberId: string, role: MemberRole) {
  if (!selectedWorkspace.value) return
  await teamApi.updateMemberRole(selectedWorkspace.value, memberId, role)
  await loadMembers(selectedWorkspace.value)
}

onMounted(async () => {
  await teamStore.fetchWorkspaces()
  if (teamStore.workspaces.length > 0) {
    await loadMembers(teamStore.workspaces[0].id)
  }
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100">Team Space</h1>
      <button
        class="px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        @click="showInviteModal = true"
      >
        Invite Member
      </button>
    </div>

    <LoadingSpinner v-if="teamStore.loading" size="lg" />

    <div v-else-if="teamStore.workspaces.length">
      <div class="flex gap-2 mb-6">
        <button
          v-for="ws in teamStore.workspaces"
          :key="ws.id"
          class="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
          :class="selectedWorkspace === ws.id
            ? 'bg-indigo-600 text-white'
            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300'"
          @click="loadMembers(ws.id)"
        >
          {{ ws.name }} ({{ ws.memberCount }})
        </button>
      </div>

      <div class="space-y-3">
        <div
          v-for="member in members"
          :key="member.id"
          class="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40"
        >
          <div class="flex items-center gap-3">
            <img :src="member.user.avatarUrl" :alt="member.user.displayName" class="w-8 h-8 rounded-full" />
            <div>
              <p class="text-sm font-medium text-zinc-800 dark:text-zinc-100">{{ member.user.displayName }}</p>
              <p class="text-xs text-zinc-400 dark:text-zinc-500">@{{ member.user.username }}</p>
            </div>
          </div>
          <select
            :value="member.role"
            class="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1 dark:text-zinc-300"
            @change="changeRole(member.id, ($event.target as HTMLSelectElement).value as MemberRole)"
          >
            <option value="ADMIN">Admin</option>
            <option value="WRITER">Writer</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-12 text-zinc-400 dark:text-zinc-500">
      <p class="text-lg font-light">No workspaces yet</p>
    </div>

    <Modal :show="showInviteModal" title="Invite Member" @close="showInviteModal = false">
      <div class="space-y-4">
        <select v-model="inviteRole" class="raw-input w-full text-sm">
          <option value="WRITER">Writer</option>
          <option value="VIEWER">Viewer</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button
          class="w-full px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          @click="createInvite"
        >
          Generate Link
        </button>
        <div v-if="inviteLink" class="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-700">
          <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Share this link:</p>
          <p class="text-sm font-mono text-zinc-800 dark:text-zinc-200 break-all">{{ inviteLink }}</p>
        </div>
      </div>
    </Modal>
  </div>
</template>
