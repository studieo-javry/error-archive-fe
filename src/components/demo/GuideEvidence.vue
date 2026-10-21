<script setup lang="ts">
import { computed } from 'vue'
import type { Step } from '@/types/error'
import { useTourStore } from '@/stores/tourStore'
import DemoIcon from '@/components/demo/DemoIcon.vue'

/**
 * 사용 가이드 2단계("시도 살펴보기")의 조사 근거 — 목업 evidenceHTML() 대응. 가이드 진행 중에만,
 * 원인을 좁힌 조사 스텝 **카드 안**(본문 아래)에 붙는다.
 *
 * 실제 스텝엔 근거 데이터가 없으므로:
 *  - 가이드 케이스(데모 시드 "HikariCP 503", `curated`)면 그 케이스 기록에 있는 피크 구간 지표로 구성
 *  - 그 외 케이스면 이 스텝의 기록(유형·결과·인사이트)으로 구성
 */
const props = defineProps<{ step: Step; curated: boolean }>()
const tourStore = useTourStore()

const STATUS_LABEL: Record<string, string> = { FAILED: 'Failed', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' }
const TYPE_LABEL: Record<string, string> = {
  CODE_CHANGE: 'Code Change', CONFIG: 'Config', DEPENDENCY: 'Dependency', ENV: 'Environment',
  ROLLBACK: 'Rollback', INVESTIGATION: 'Investigation', OTHER: 'Other',
}

const evidence = computed(() => {
  if (props.curated) {
    return {
      title: '피크 구간 커넥션 보유 시간',
      lines: [
        { label: '평균 쿼리 실행 시간', value: '12 ms' },
        { label: '활성 커넥션 (피크)', value: '10 / 10' },
        { label: '대기 요청 (pending)', value: '37 → 41' },
        { label: '커넥션 반납 시점', value: '응답 완료 후 (OSIV)' },
      ],
      note: '쿼리는 12ms 에 끝나지만 open-in-view 로 커넥션이 뷰 렌더까지 유지돼, 피크에 10개 풀이 바로 소진됐습니다.',
      source: '샘플 케이스 피크 구간 지표',
    }
  }
  const s = props.step
  return {
    title: s.title,
    lines: [
      ...(s.attemptType ? [{ label: '시도 유형', value: TYPE_LABEL[s.attemptType] ?? s.attemptType }] : []),
      { label: '결과', value: STATUS_LABEL[s.status] ?? s.status },
    ],
    note: s.insight ?? null,
    source: '이 시도의 기록에서 정리',
  }
})

function onToggle(e: Event) {
  if ((e.target as HTMLDetailsElement).open) tourStore.setFlag('evidenceRead', true)
}
</script>

<template>
  <div class="demo-ui common-evidence" data-tour="evidence">
    <details class="evidence" :open="tourStore.flags.evidenceRead" @toggle="onToggle">
      <summary>
        <span><DemoIcon name="code" /> 조사 근거 · {{ evidence.title }}</span>
        <DemoIcon name="down" />
      </summary>
      <div class="evidence-content">
        <div v-for="l in evidence.lines" :key="l.label" class="evidence-line">
          <span>{{ l.label }}</span><strong class="mono">{{ l.value }}</strong>
        </div>
        <p>
          <template v-if="evidence.note">{{ evidence.note }}</template>
          <span class="soft evidence-source">{{ evidence.source }}</span>
        </p>
      </div>
    </details>
  </div>
</template>
