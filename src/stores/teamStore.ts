import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { teamApi } from '@/services/teamApi'
import type { WorkspaceListItem } from '@/types/team'

/** URL slug for the shared/public (non-team) workspace. */
export const PUBLIC_SLUG = 'public'

export const useTeamStore = defineStore('team', () => {
  const workspaces = ref<WorkspaceListItem[]>([])
  const loading = ref(false)
  // Currently selected workspace (null = Public, the shared common space).
  const currentWorkspaceId = ref<number | null>(null)

  const currentWorkspace = computed(
    () => workspaces.value.find(w => w.workspaceId === currentWorkspaceId.value) ?? null,
  )

  // URL slug for the current workspace (Public → 'public').
  const currentSlug = computed(() => currentWorkspace.value?.slug ?? PUBLIC_SLUG)

  async function fetchWorkspaces() {
    loading.value = true
    try {
      const { data } = await teamApi.listWorkspaces()
      workspaces.value = data
    } finally {
      loading.value = false
    }
  }

  function setCurrentWorkspace(id: number | null) {
    currentWorkspaceId.value = id
  }

  // Resolve a URL slug → current workspace selection (used by the router guard).
  async function resolveSlug(slug: string) {
    if (slug === PUBLIC_SLUG) {
      currentWorkspaceId.value = null
      return
    }
    if (!workspaces.value.length) await fetchWorkspaces()
    const ws = workspaces.value.find(w => w.slug === slug)
    currentWorkspaceId.value = ws ? ws.workspaceId : null
  }

  return {
    workspaces,
    loading,
    currentWorkspaceId,
    currentWorkspace,
    currentSlug,
    fetchWorkspaces,
    setCurrentWorkspace,
    resolveSlug,
  }
})
