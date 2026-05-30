import apiClient from './apiClient'
import type { ApiResponse } from '@/types/api'
import type { Workspace, WorkspaceCreateRequest, Member, MemberRole, Invitation, InvitationCreateRequest } from '@/types/team'

export const teamApi = {
  listWorkspaces() {
    return apiClient.get<ApiResponse<Workspace[]>>('/workspaces')
  },

  createWorkspace(data: WorkspaceCreateRequest) {
    return apiClient.post<ApiResponse<Workspace>>('/workspaces', data)
  },

  getWorkspace(id: string) {
    return apiClient.get<ApiResponse<Workspace>>(`/workspaces/${id}`)
  },

  deleteWorkspace(id: string) {
    return apiClient.delete<ApiResponse<null>>(`/workspaces/${id}`)
  },

  getMembers(workspaceId: string) {
    return apiClient.get<ApiResponse<Member[]>>(`/workspaces/${workspaceId}/members`)
  },

  updateMemberRole(workspaceId: string, memberId: string, role: MemberRole) {
    return apiClient.put<ApiResponse<Member>>(`/workspaces/${workspaceId}/members/${memberId}`, { role })
  },

  removeMember(workspaceId: string, memberId: string) {
    return apiClient.delete<ApiResponse<null>>(`/workspaces/${workspaceId}/members/${memberId}`)
  },

  createInvitation(workspaceId: string, data: InvitationCreateRequest) {
    return apiClient.post<ApiResponse<Invitation>>(`/workspaces/${workspaceId}/invitations`, data)
  },

  acceptInvitation(token: string) {
    return apiClient.post<ApiResponse<{ workspace: Workspace; role: MemberRole }>>(`/invitations/${token}/accept`)
  },

  getInvitationInfo(token: string) {
    return apiClient.get<ApiResponse<{ workspaceName: string; role: MemberRole; expiresAt: string }>>(`/invitations/${token}`)
  },
}
