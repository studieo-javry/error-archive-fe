<script setup lang="ts">
import { computed } from 'vue'
import { useGuestSession } from '@/composables/useGuestSession'
import { useTour } from '@/composables/useTour'
import { useTourStore } from '@/stores/tourStore'
import DemoIcon from '@/components/demo/DemoIcon.vue'

const { remainingLabel } = useGuestSession()
const { start: startTour } = useTour()
const tourStore = useTourStore()

// 목업의 상태별 가이드 라벨.
const guideLabel = computed(() => {
  if (tourStore.status === 'active') return `가이드 진행 중 · ${tourStore.step + 1}/4`
  if (tourStore.status === 'done') return '가이드 다시 보기'
  return '사용 가이드'
})
</script>

<template>
  <div class="demo-ui">
    <div class="session-banner" role="status">
      <div class="session-left">
        <span class="session-dot" />
        <strong>게스트 모드</strong>
        <span class="session-copy">샘플 데이터로 자유롭게 둘러보세요. 파일 업로드·발행 등 일부 기능은 비활성화돼 있고, 변경사항은 매일 초기화돼요.</span>
      </div>
      <div class="session-right">
        <span v-if="remainingLabel" class="timer" title="데모 세션 남은 시간">
          <DemoIcon name="clock" /><span>{{ remainingLabel }}</span>
        </span>
        <button type="button" class="banner-guide" @click="startTour">
          <DemoIcon name="compass" />{{ guideLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
