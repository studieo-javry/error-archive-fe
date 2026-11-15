import apiClient from './apiClient'
import type {
  Capture,
  CaptureDetail,
  CaptureHistoryPage,
  CaptureMetrics,
  CaptureStatus,
  ImportCaptureRequest,
  ImportCaptureResult,
  ReviewQueuePage,
} from '@/types/capture'

// core-api /captures — 자동 수집 초안의 사용자 검토·반영·폐기(세션 사용자 전용, 본인 소유만).
export const captureApi = {
  /** 검토 큐(READY_FOR_REVIEW) — cursor 생략=첫 페이지, nextCursor 를 다음 cursor 로. limit 기본 20·최대 100. */
  reviewQueue(cursor?: string | null, limit?: number) {
    return apiClient.get<ReviewQueuePage>('/captures', {
      params: { ...(cursor ? { cursor } : {}), ...(limit != null ? { limit } : {}) },
    })
  },
  /** 자동기록 계측(퍼널). windowDays 기본 30(1~365 클램프). */
  metrics(windowDays?: number) {
    return apiClient.get<CaptureMetrics>('/captures/metrics', {
      params: windowDays != null ? { windowDays } : undefined,
    })
  },
  /** 초안 상세(Attempt·Solution·근거 포함). 본인 소유 아니면 404. */
  detail(captureUuid: string) {
    return apiClient.get<CaptureDetail>(`/captures/${captureUuid}`)
  },
  /**
   * 검토 확정 → 신규 비공개 ErrorCase 로 반영. 멱등 키 필수.
   * 201=신규, 200=이미 반영(멱등). 409=봉인안됨/폐기/revision 충돌, 422=검증 룰 위반.
   */
  import(captureUuid: string, request: ImportCaptureRequest, idempotencyKey: string) {
    return apiClient.post<ImportCaptureResult>(`/captures/${captureUuid}/import`, request, {
      headers: { 'Idempotency-Key': idempotencyKey },
    })
  },
  /** 초안 폐기(DISCARDED). 이미 폐기면 멱등, 이미 반영(IMPORTED)이면 409. */
  discard(captureUuid: string) {
    return apiClient.post<Capture>(`/captures/${captureUuid}/discard`)
  },
  /** 검토 완료 이력(IMPORTED·DISCARDED). status 로 한 상태만 필터(생략 시 둘 다). cursor 페이지. */
  history(status?: CaptureStatus | null, cursor?: string | null, limit?: number) {
    return apiClient.get<CaptureHistoryPage>('/captures/history', {
      params: {
        ...(status ? { status } : {}),
        ...(cursor ? { cursor } : {}),
        ...(limit != null ? { limit } : {}),
      },
    })
  },
  /** 폐기 복원 — 폐기 직전 단계로(봉인 이력 있으면 READY_FOR_REVIEW, 아니면 OPEN). 응답 status 로 실제 복원 상태 확인. */
  restore(captureUuid: string) {
    return apiClient.post<Capture>(`/captures/${captureUuid}/restore`)
  },
}

export default captureApi
