import { defineStore } from 'pinia'
import { ref } from 'vue'
import { errorApi } from '@/services/errorApi'
import type { ErrorCaseSummary, ErrorStatus } from '@/types/error'

export const useErrorStore = defineStore('error', () => {
  const errors = ref<ErrorCaseSummary[]>([])
  const total = ref(0)
  const page = ref(1)
  const size = ref(20)
  const hasNext = ref(false)
  const loading = ref(false)
  const statusFilter = ref<ErrorStatus | ''>('')
  const searchQuery = ref('')

  async function fetchErrors() {
    loading.value = true
    try {
      const params: Record<string, unknown> = { page: page.value, size: size.value }
      if (statusFilter.value) params.status = statusFilter.value
      if (searchQuery.value) params.search = searchQuery.value
      const { data } = await errorApi.list(params as Parameters<typeof errorApi.list>[0])
      errors.value = data.data.items
      total.value = data.data.total
      hasNext.value = data.data.hasNext
    } finally {
      loading.value = false
    }
  }

  function setPage(p: number) {
    page.value = p
    fetchErrors()
  }

  function setFilter(status: ErrorStatus | '') {
    statusFilter.value = status
    page.value = 1
    fetchErrors()
  }

  return { errors, total, page, size, hasNext, loading, statusFilter, searchQuery, fetchErrors, setPage, setFilter }
})
