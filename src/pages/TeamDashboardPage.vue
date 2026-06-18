<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTeamStore } from '@/stores/teamStore'
import { teamApi } from '@/services/teamApi'
import type { WorkspaceMember } from '@/types/team'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Modal from '@/components/common/Modal.vue'

const teamStore = useTeamStore()
const members = ref<WorkspaceMember[]>([])
const showInviteModal = ref(false)
const inviteRole = ref('WRITE')
const inviteLink = ref('')
const selectedWorkspace = ref<number | null>(null)
const showCreateModal = ref(false)
const showJoinModal = ref(false)
const newTeamName = ref('')
const joinToken = ref('')
const creating = ref(false)
const joining = ref(false)

async function loadMembers(wsId: number) {
  selectedWorkspace.value = wsId
  const { data } = await teamApi.getMembers(wsId)
  members.value = data
}

async function createInvite() {
  if (selectedWorkspace.value === null) return
  const { data } = await teamApi.createInvitation(selectedWorkspace.value, { type: 'LINK', role: inviteRole.value, expiresInHours: 168 })
  if (data.inviteUrl) {
    inviteLink.value = data.inviteUrl
  } else if (data.inviteToken) {
    inviteLink.value = `${window.location.origin}/invite/${data.inviteToken}`
  }
}

async function changeRole(userId: number, role: string) {
  if (selectedWorkspace.value === null) return
  await teamApi.changeMemberRole(selectedWorkspace.value, userId, role)
  await loadMembers(selectedWorkspace.value)
}

async function createTeam() {
  if (!newTeamName.value.trim()) return
  creating.value = true
  try {
    await teamApi.createWorkspace({ name: newTeamName.value.trim() })
    newTeamName.value = ''
    showCreateModal.value = false
    await teamStore.fetchWorkspaces()
    if (teamStore.workspaces.length > 0) {
      await loadMembers(teamStore.workspaces[0].workspaceId)
    }
  } finally {
    creating.value = false
  }
}

async function joinTeam() {
  if (!joinToken.value.trim()) return
  joining.value = true
  try {
    await teamApi.acceptInvitation(joinToken.value.trim())
    joinToken.value = ''
    showJoinModal.value = false
    await teamStore.fetchWorkspaces()
    if (teamStore.workspaces.length > 0) {
      await loadMembers(teamStore.workspaces[0].workspaceId)
    }
  } finally {
    joining.value = false
  }
}

onMounted(async () => {
  await teamStore.fetchWorkspaces()
  if (teamStore.workspaces.length > 0) {
    await loadMembers(teamStore.workspaces[0].workspaceId)
  }
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100">Team Space</h1>
      <button
        class="px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
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
          :key="ws.workspaceId"
          class="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
          :class="selectedWorkspace === ws.workspaceId
            ? 'bg-emerald-600 text-white'
            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300'"
          @click="loadMembers(ws.workspaceId)"
        >
          {{ ws.name }}
        </button>
      </div>

      <div class="space-y-3">
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
    </div>

    <div v-else class="flex flex-col items-center justify-center py-16 text-center border-t border-zinc-200 dark:border-zinc-800 mt-4 max-w-3xl mx-auto px-8">
      <div class="mb-10 text-emerald-500 dark:text-emerald-400 flex items-center gap-2 opacity-90">
        <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 640 512"><path d="M72 88a56 56 0 1 1 112 0A56 56 0 1 1 72 88zM64 245.7C54 256.9 48 271.8 48 288s6 31.1 16 42.3V245.7zm144.4-49.3C178.7 222.7 160 261.2 160 304c0 34.3 12 65.8 32 90.5V416c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V389.2C26.2 371.2 0 332.7 0 288c0-61.9 50.1-112 112-112h32c24 0 46.2 7.5 64.4 20.3zM448 416V394.5c20-24.7 32-56.2 32-90.5c0-42.8-18.7-81.3-48.4-107.7C449.8 183.5 472 176 496 176h32c61.9 0 112 50.1 112 112c0 44.7-26.2 83.2-64 101.2V416c0 17.7-14.3 32-32 32H480c-17.7 0-32-14.3-32-32zM568 88A56 56 0 1 0 456 88a56 56 0 1 0 112 0zM320 176a56 56 0 1 0 0-112 56 56 0 1 0 0 112zM192 304c0 44.7 26.2 83.2 64 101.2V448c0 17.7 14.3 32 32 32h64c17.7 0 32-14.3 32-32V405.2c37.8-18 64-56.5 64-101.2c0-61.9-50.1-112-112-112H304c-61.9 0-112 50.1-112 112z"/></svg>
        <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
        <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 640 512"><path d="M256 64H384v64H256V64zM240 0c-26.5 0-48 21.5-48 48v96c0 26.5 21.5 48 48 48h48v32H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96v32H80c-26.5 0-48 21.5-48 48v96c0 26.5 21.5 48 48 48H240c26.5 0 48-21.5 48-48V368c0-26.5-21.5-48-48-48H192V288h256v32H400c-26.5 0-48 21.5-48 48v96c0 26.5 21.5 48 48 48H560c26.5 0 48-21.5 48-48V368c0-26.5-21.5-48-48-48H512V288h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H352V192h48c26.5 0 48-21.5 48-48V48c0-26.5-21.5-48-48-48H240zM96 448V368H224v80H96zm320 0V368H544v80H416z"/></svg>
      </div>

      <h3 class="serif-title text-4xl leading-tight text-zinc-800 dark:text-zinc-200 mb-6 max-w-xl mx-auto">
        Alone We Debug,<br>Together We <span class="text-emerald-600 dark:text-emerald-400 italic">Resolve.</span>
      </h3>

      <p class="text-zinc-500 font-light text-base leading-relaxed mb-16 max-w-2xl mx-auto px-4">
        "If I have seen further, it is by standing on the shoulders of giants." Bring your team together, share hard-won lessons, and build a collective memory that makes everyone stronger.
      </p>

      <div class="flex flex-col sm:flex-row gap-10 text-xs font-bold uppercase tracking-widest justify-center">
        <button
          class="group text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-all flex items-center gap-3 pb-1 border-b border-transparent hover:border-emerald-600 dark:hover:border-emerald-400"
          @click="showCreateModal = true"
        >
          Create Team
          <svg class="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
        </button>
        <button
          class="group text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-all flex items-center gap-3 pb-1 border-b border-transparent hover:border-emerald-600 dark:hover:border-emerald-400"
          @click="showJoinModal = true"
        >
          Join Team
          <svg class="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </button>
      </div>
    </div>

    <Modal :show="showCreateModal" title="Create Team" @close="showCreateModal = false">
      <div class="space-y-4">
        <input v-model="newTeamName" placeholder="Team name" class="raw-input w-full text-sm" @keyup.enter="createTeam" />
        <button
          class="w-full px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          :disabled="creating || !newTeamName.trim()"
          @click="createTeam"
        >
          {{ creating ? 'Creating...' : 'Create' }}
        </button>
      </div>
    </Modal>

    <Modal :show="showJoinModal" title="Join Team" @close="showJoinModal = false">
      <div class="space-y-4">
        <input v-model="joinToken" placeholder="Paste invitation link or token" class="raw-input w-full text-sm" @keyup.enter="joinTeam" />
        <button
          class="w-full px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          :disabled="joining || !joinToken.trim()"
          @click="joinTeam"
        >
          {{ joining ? 'Joining...' : 'Join' }}
        </button>
      </div>
    </Modal>

    <Modal :show="showInviteModal" title="Invite Member" @close="showInviteModal = false">
      <div class="space-y-4">
        <select v-model="inviteRole" class="raw-input w-full text-sm">
          <option value="WRITE">Write</option>
          <option value="READ">Read</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button
          class="w-full px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
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
