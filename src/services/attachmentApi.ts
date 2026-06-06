import apiClient from './apiClient'
import type { AttachmentUploadResponse } from '@/types/error'

export const attachmentApi = {
  upload(data: { file: File; title?: string; caption?: string }) {
    const formData = new FormData()
    formData.append('file', data.file)
    if (data.title) formData.append('title', data.title)
    if (data.caption) formData.append('caption', data.caption)
    return apiClient.post<AttachmentUploadResponse>('/error-attachments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  downloadUrl(markerId: string) {
    return `/api/v1/error-attachments/${markerId}`
  },

  delete(markerId: string) {
    return apiClient.delete<void>(`/error-attachments/${markerId}`)
  },
}
