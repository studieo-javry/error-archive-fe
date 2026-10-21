import apiClient from './apiClient'
import type { DemoGuideResponse } from '@/types/user'

/** core-api 게스트 데모 API. */
export const demoApi = {
  /** 사용 가이드 대상(샘플 케이스 id + 공개 아티클 slug). 데모 비활성/시드 없음이면 404. */
  guide() {
    return apiClient.get<DemoGuideResponse>('/demo/guide')
  },
}
