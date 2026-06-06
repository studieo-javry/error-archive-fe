import apiClient from './apiClient'
import type {
  Workspace,
  WorkspaceListItem,
  WorkspaceCreateRequest,
  WorkspaceUpdateRequest,
  WorkspaceMember,
  CreateInvitationRequest,
  CreateInvitationResponse,
  InvitationItem,
  InvitationPreview,
  AcceptInvitationResponse,
} from '@/types/team'

export const teamApi = {
  // ── Workspaces ──

  listWorkspaces() {
    return apiClient.get<WorkspaceListItem[]>('/workspaces')
  },

  createWorkspace(data: WorkspaceCreateRequest) {
    return apiClient.post<Workspace>('/workspaces', data)
  },

  getWorkspace(id: number) {
    return apiClient.get<Workspace>(`/workspaces/${id}`)
  },

  updateWorkspace(id: number, data: WorkspaceUpdateRequest) {
    return apiClient.patch<Workspace>(`/workspaces/${id}`, data)
  },

  deleteWorkspace(id: number) {
    return apiClient.delete<void>(`/workspaces/${id}`)
  },

  // ── Members ──

  getMembers(workspaceId: number) {
    return apiClient.get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`)
  },

  changeMemberRole(workspaceId: number, userId: number, role: string) {
    return apiClient.patch<void>(`/workspaces/${workspaceId}/members/${userId}`, { role })
  },

  removeMember(workspaceId: number, userId: number) {
    return apiClient.delete<void>(`/workspaces/${workspaceId}/members/${userId}`)
  },

  leaveWorkspace(workspaceId: number) {
    return apiClient.delete<void>(`/workspaces/${workspaceId}/members/me`)
  },

  // ── Invitations ──

  createInvitation(workspaceId: number, data: CreateInvitationRequest) {
    return apiClient.post<CreateInvitationResponse>(`/workspaces/${workspaceId}/invitations`, data)
  },

  listInvitations(workspaceId: number) {
    return apiClient.get<InvitationItem[]>(`/workspaces/${workspaceId}/invitations`)
  },

  revokeInvitation(workspaceId: number, invitationId: number) {
    return apiClient.delete<void>(`/workspaces/${workspaceId}/invitations/${invitationId}`)
  },

  previewInvitation(token: string) {
    return apiClient.get<InvitationPreview>('/invitations/preview', { params: { token } })
  },

  acceptInvitation(token: string) {
    return apiClient.post<AcceptInvitationResponse>('/invitations/accept', { token })
  },
}
