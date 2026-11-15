<script setup lang="ts">
import type { Verification } from '@/types/capture'
import { VERIFICATION_RESULT_LABELS } from '@/utils/captureLabels'

const props = defineProps<{ verification: Verification | null | undefined }>()

function tone(v: Verification): string {
  return v.result === 'PASSED' ? 'green' : v.result === 'FAILED' ? 'rose' : 'amber'
}
</script>

<template>
  <div class="verify">
    <template v-if="props.verification">
      <div class="row between">
        <span class="tiny muted">검증 결과</span>
        <div class="row" style="gap: 5px">
          <span class="badge" :class="tone(props.verification)">{{ VERIFICATION_RESULT_LABELS[props.verification.result] }}</span>
          <span class="badge">{{ props.verification.scope || '범위 미지정' }}</span>
        </div>
      </div>
      <pre v-if="props.verification.command">{{ props.verification.command }}</pre>
      <p v-if="props.verification.evidence" class="small">{{ props.verification.evidence }}</p>
      <div class="v-grid">
        <span>{{ props.verification.executed ? '실제 실행함' : '실행하지 않음' }}</span>
        <span v-if="props.verification.testId">Test · {{ props.verification.testId }}</span>
        <span v-if="props.verification.commitSha">Commit · {{ props.verification.commitSha }}</span>
        <span v-if="props.verification.ranAt">{{ props.verification.ranAt }}</span>
      </div>
    </template>
    <span v-else class="small muted">검증 정보 없이 반영합니다.</span>
  </div>
</template>
