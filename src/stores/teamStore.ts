import { defineStore } from 'pinia'
import { ref } from 'vue'
import { teamApi } from '@/services/teamApi'
import type { WorkspaceListItem } from '@/types/team'

export const useTeamStore = defineStore('team', () => {
  const workspaces = ref<WorkspaceListItem[]>([])
  const loading = ref(false)

  async function fetchWorkspaces() {
    loading.value = true
    try {
      const { data } = await teamApi.listWorkspaces()
      workspaces.value = data
    } finally {
      loading.value = false
    }
  }

  return { workspaces, loading, fetchWorkspaces }
})
