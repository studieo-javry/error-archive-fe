import { defineStore } from 'pinia'
import { ref } from 'vue'
import { errorApi } from '@/services/errorApi'
import type { ErrorCaseSummary } from '@/types/error'

export const useErrorStore = defineStore('error', () => {
  const errors = ref<ErrorCaseSummary[]>([])
  const nextCursor = ref<string | null>(null)
  const hasNext = ref(false)
  const size = ref(20)
  const loading = ref(false)
  const statusFilter = ref<string>('')

  async function fetchErrors(append = false) {
    loading.value = true
    try {
      const params: Record<string, unknown> = { size: size.value }
      if (statusFilter.value) params.status = statusFilter.value
      if (append && nextCursor.value) params.cursor = nextCursor.value
      const { data } = await errorApi.list(params as Parameters<typeof errorApi.list>[0])
      if (append) {
        errors.value.push(...data.items)
      } else {
        errors.value = data.items
      }
      nextCursor.value = data.nextCursor
      hasNext.value = data.hasNext
    } finally {
      loading.value = false
    }
  }

  function loadMore() {
    if (hasNext.value && !loading.value) {
      fetchErrors(true)
    }
  }

  function setFilter(status: string) {
    statusFilter.value = status
    nextCursor.value = null
    fetchErrors()
  }

  return { errors, nextCursor, hasNext, size, loading, statusFilter, fetchErrors, loadMore, setFilter }
})
