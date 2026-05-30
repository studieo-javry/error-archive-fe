import apiClient from './apiClient'
import type { ApiResponse } from '@/types/api'

export interface Comment {
  id: string
  targetType: 'ERROR_CASE' | 'STEP'
  targetId: string
  content: string
  authorId: string
  author: { id: string; username: string; displayName: string; avatarUrl: string }
  parentId?: string
  replies: Comment[]
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export const commentApi = {
  list(targetType: string, targetId: string) {
    return apiClient.get<ApiResponse<Comment[]>>('/comments', { params: { targetType, targetId } })
  },

  create(data: { content: string; targetType: string; targetId: string; parentId?: string }) {
    return apiClient.post<ApiResponse<Comment>>('/comments', data)
  },

  delete(id: string) {
    return apiClient.delete<ApiResponse<null>>(`/comments/${id}`)
  },
}
