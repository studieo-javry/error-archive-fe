import apiClient from './apiClient'
import type { ApiResponse } from '@/types/api'
import type { Attachment, AttachmentUpdateRequest } from '@/types/error'

export const attachmentApi = {
  list(errorId: string) {
    return apiClient.get<ApiResponse<Attachment[]>>(`/errors/${errorId}/attachments`)
  },

  upload(errorId: string, data: { title?: string; caption?: string; file: File }) {
    const formData = new FormData()
    formData.append('file', data.file)
    if (data.title) formData.append('title', data.title)
    if (data.caption) formData.append('caption', data.caption)
    return apiClient.post<ApiResponse<Attachment>>(`/errors/${errorId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  update(errorId: string, attachmentId: string, data: AttachmentUpdateRequest) {
    return apiClient.put<ApiResponse<Attachment>>(`/errors/${errorId}/attachments/${attachmentId}`, data)
  },

  delete(errorId: string, attachmentId: string) {
    return apiClient.delete<ApiResponse<null>>(`/errors/${errorId}/attachments/${attachmentId}`)
  },
}
