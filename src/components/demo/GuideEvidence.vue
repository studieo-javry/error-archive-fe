<script setup lang="ts">
import { computed } from 'vue'
import type { Step } from '@/types/error'
import { useTourStore } from '@/stores/tourStore'
import DemoIcon from '@/components/demo/DemoIcon.vue'

/**
 * 사용 가이드 2단계("시도 살펴보기")용 조사 근거 블록 — 목업 evidenceHTML() 대응, 가이드 진행 중에만 보인다.
 * 실제 케이스엔 근거 데이터가 없으므로, 샘플 케이스의 타임라인에서 시도별 결과를 뽑아 근거로 보여준다 —
 * 그래서 가이드가 어떤 시드 케이스를 고르든 내용이 그 케이스와 맞는다.
 */
const props = defineProps<{ steps: Step[] }>()
const tourStore = useTourStore()

const STATUS_LABEL: Record<string, string> = { FAILED: 'Failed', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' }
const TYPE_LABEL: Record<string, string> = {
  CODE_CHANGE: 'Code Change', CONFIG: 'Config', DEPENDENCY: 'Dependency', ENV: 'Environment',
  ROLLBACK: 'Rollback', INVESTIGATION: 'Investigation', OTHER: 'Other',
}

const lines = computed(() =>
  props.steps.map(s => ({
    id: s.id,
    label: s.title,
    value: [s.attemptType ? (TYPE_LABEL[s.attemptType] ?? s.attemptType) : null, STATUS_LABEL[s.status] ?? s.status]
      .filter(Boolean)
      .join(' · '),
  })),
)

const failedCount = computed(() => props.steps.filter(s => s.status === 'FAILED').length)

// 해결로 이어진 시도의 인사이트(없으면 마지막 인사이트)를 결론으로.
const conclusion = computed(() => {
  const resolved = [...props.steps].reverse().find(s => s.status === 'RESOLVED' && s.insight)
  return (resolved ?? [...props.steps].reverse().find(s => s.insight))?.insight ?? null
})

function onToggle(e: Event) {
  if ((e.target as HTMLDetailsElement).open) tourStore.setFlag('evidenceRead', true)
}
</script>

<template>
  <div v-if="steps.length" class="demo-ui common-evidence" data-tour="evidence">
    <p class="addition-label" data-tour-chip>가이드 · 조사 근거</p>
    <details class="evidence" :open="tourStore.flags.evidenceRead" @toggle="onToggle">
      <summary>
        <span><DemoIcon name="code" /> 조사 근거 · 시도 {{ steps.length }}건의 결과</span>
        <DemoIcon name="down" />
      </summary>
      <div class="evidence-content">
        <div v-for="l in lines" :key="l.id" class="evidence-line">
          <span>{{ l.label }}</span><strong class="mono">{{ l.value }}</strong>
        </div>
        <p>
          <template v-if="conclusion">{{ conclusion }}</template>
          <template v-else-if="failedCount">실패한 시도 {{ failedCount }}건이 다음 시도의 방향을 정했어요.</template>
          <span class="soft evidence-source">샘플 케이스 타임라인에서 정리</span>
        </p>
      </div>
    </details>
  </div>
</template>
