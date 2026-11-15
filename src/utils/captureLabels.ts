// Agent Capture 화면 공용 라벨(목업과 일치). 상태/결과/검증 enum → 표시 문자열.
import type { CaptureStatus, AttemptResult, StepStatus, VerificationResult } from '@/types/capture'

export const CAPTURE_STATE_LABELS: Record<CaptureStatus, string> = {
  READY_FOR_REVIEW: '검토 대기',
  OPEN: '기록 중',
  IMPORTED: '반영 완료',
  DISCARDED: '폐기됨',
}

export const ATTEMPT_RESULT_LABELS: Record<AttemptResult, string> = {
  SUCCEEDED: '성공',
  FAILED: '실패',
  PENDING: '진행 중',
  INCONCLUSIVE: '판단 보류',
}

// 반영 Step 상태 — 목업 최종본은 영문 표기.
export const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  IN_PROGRESS: 'In Progress',
  FAILED: 'Failed',
  RESOLVED: 'Resolved',
}

export const VERIFICATION_RESULT_LABELS: Record<VerificationResult, string> = {
  PASSED: '통과',
  FAILED: '실패',
  NOT_RUN: '미실행',
  INCONCLUSIVE: '판단 보류',
}
