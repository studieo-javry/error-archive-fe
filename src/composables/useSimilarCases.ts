import { ref, watch, onBeforeUnmount, type Ref } from 'vue'
import { errorApi } from '@/services/errorApi'
import type { SimilarCaseItem } from '@/types/error'

const MIN_LEN = 2
const DEBOUNCE_MS = 220
const LIMIT = 6

/**
 * 유사 에러 추천 — 제목 입력을 디바운스해 `GET /error-cases/similar` 호출.
 * - 2자 미만이면 비움, 직전 요청은 AbortController 로 취소(경합/깜빡임 방지).
 * - 보조 기능이라 **조용히 실패**(토스트/에러 노출 X): 실패 시 빈 목록.
 * - `enabled` 가 false 면 호출하지 않음(데모 게이팅/수정 화면 제외 등).
 */
export function useSimilarCases(
  query: Ref<string>,
  workspaceId: Ref<number | null>,
  opts?: { enabled?: Ref<boolean> },
) {
  const items = ref<SimilarCaseItem[]>([])
  const loading = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null
  let controller: AbortController | null = null

  function reset() {
    items.value = []
    loading.value = false
  }

  async function run(q: string) {
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    try {
      const { data } = await errorApi.similar(
        { q, workspaceId: workspaceId.value ?? undefined, limit: LIMIT },
        controller.signal,
      )
      items.value = data.items
    } catch (e: unknown) {
      // 취소(abort)는 정상 흐름 — 무시. 그 외 실패도 조용히 비움.
      const code = (e as { code?: string } | null)?.code
      if (code !== 'ERR_CANCELED' && code !== 'CanceledError') items.value = []
    } finally {
      loading.value = false
    }
  }

  watch(
    query,
    (q) => {
      if (opts?.enabled && !opts.enabled.value) {
        if (timer) clearTimeout(timer)
        controller?.abort()
        reset()
        return
      }
      const trimmed = q.trim()
      if (timer) clearTimeout(timer)
      if (trimmed.length < MIN_LEN) {
        controller?.abort()
        reset()
        return
      }
      timer = setTimeout(() => run(trimmed), DEBOUNCE_MS)
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
    controller?.abort()
  })

  return { items, loading }
}
