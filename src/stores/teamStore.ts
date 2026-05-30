import { defineStore } from 'pinia'
import { ref } from 'vue'
import { teamApi } from '@/services/teamApi'
import type { Workspace } from '@/types/team'

export const useTeamStore = defineStore('team', () => {
  const workspaces = ref<Workspace[]>([])
  const loading = ref(false)

  async function fetchWorkspaces() {
    loading.value = true
    try {
      const { data } = await teamApi.listWorkspaces()
      workspaces.value = data.data
    } finally {
      loading.value = false
    }
  }

  return { workspaces, loading, fetchWorkspaces }
})
