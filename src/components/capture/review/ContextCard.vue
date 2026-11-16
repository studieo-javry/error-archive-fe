<script setup lang="ts">
// 01 문제 맥락 — compact brief(contextD). 본문을 직접 수정했으면 markdown 프리뷰(ctx-modified)로 전환.
import { computed } from 'vue'
import CapIcon from '@/components/capture/CapIcon.vue'
import CaptureBodyRenderer from './CaptureBodyRenderer.vue'
import { defaultBody } from '@/composables/useCaptureReview'
import type { CaptureReview } from '@/composables/useCaptureReview'
import type { CaptureContent, CaptureDetail } from '@/types/capture'

const props = defineProps<{ review: CaptureReview; detail: CaptureDetail }>()
const emit = defineEmits<{ edit: []; original: [] }>()

const content = computed<CaptureContent>(() => props.detail.capture.content)
const modified = computed(() => props.review.draft.body !== defaultBody(content.value))
// 에이전트 리치 본문(@snippet/@attach 포함)이 있으면 compact brief 대신 본문 렌더러로.
const hasRichBody = computed(() => !!content.value.bodyMarkdown && content.value.bodyMarkdown.trim().length > 0)
const showBrief = computed(() => !hasRichBody.value && !modified.value)

const ENV_NAMES: Record<string, string> = {
  service: 'Service', branch: 'Branch', commitSha: 'Commit', dirtyWorktree: 'Working tree', diffRef: 'Diff',
}
const envAttrs = computed(() =>
  Object.entries(content.value.environment ?? {})
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => ({
      name: ENV_NAMES[k] ?? k,
      value: typeof v === 'boolean' ? (v ? 'Modified' : 'Clean') : String(v),
    })),
)
const hasUnknowns = computed(() => (content.value.unknowns?.length ?? 0) > 0)
</script>

<template>
  <section class="section" id="context">
    <div class="section-head">
      <h3><span class="num">01</span>문제 맥락</h3>
      <button type="button" class="btn ghost small" @click="emit('edit')"><CapIcon name="edit" />제목·본문 수정</button>
    </div>

    <div v-if="!showBrief" :class="modified ? 'ctx-modified' : 'card'">
      <div v-if="modified" class="row between" style="margin-bottom: 15px">
        <span class="badge green">반영 본문 수정됨</span>
        <button type="button" class="text-btn" @click="emit('original')">수집 원본 보기</button>
      </div>
      <CaptureBodyRenderer :body="review.draft.body" :snippets="content.snippets" :artifacts="detail.artifacts" />
    </div>

    <div v-else class="clean-context clean-d">
      <div class="clean-brief-head">
        <div class="clean-eyebrow">문제 요약</div>
        <p class="clean-symptom">{{ content.symptom || '증상이 기록되지 않았습니다.' }}</p>
      </div>

      <div class="clean-brief-grid">
        <div class="clean-group">
          <div class="clean-head">관측 사실</div>
          <ul class="clean-list">
            <li v-for="(v, i) in (content.observedFacts.length ? content.observedFacts : ['아직 기록된 내용이 없습니다.'])" :key="i">{{ v }}</li>
          </ul>
        </div>
        <div class="clean-group">
          <div class="clean-head">원인 가설</div>
          <ul class="clean-list theory">
            <li v-for="(v, i) in (content.hypotheses.length ? content.hypotheses : ['아직 기록된 내용이 없습니다.'])" :key="i">{{ v }}</li>
          </ul>
        </div>
      </div>

      <div class="clean-brief-steps">
        <div class="clean-head-row">
          <div class="clean-head">재현 절차</div>
          <span class="clean-execution" :class="content.reproduction?.executed ? 'done' : 'pending'">
            {{ content.reproduction?.executed ? '● 실행 확인됨' : '○ 제안 · 미실행' }}
          </span>
        </div>
        <div v-if="content.reproduction?.steps.length" class="clean-steps">
          <div v-for="(s, i) in content.reproduction.steps" :key="i" class="clean-step">
            <span class="clean-step-n">{{ i + 1 }}</span><span>{{ s }}</span>
          </div>
        </div>
        <p v-else class="clean-fallback">재현 절차가 기록되지 않았습니다.</p>
      </div>

      <details class="clean-more" :open="hasUnknowns">
        <summary><span>추가 확인 사항 · 실행 환경</span><CapIcon name="down" /></summary>
        <div>
          <div v-if="hasUnknowns" class="clean-remain">
            <span class="clean-remain-label">미확인</span>
            <p>{{ content.unknowns.join(' / ') }}</p>
          </div>
          <div class="clean-meta" aria-label="수집 환경">
            <span v-for="(a, i) in envAttrs" :key="i" class="clean-env-attr"><span>{{ a.name }}</span>{{ a.value }}</span>
          </div>
        </div>
      </details>
    </div>
  </section>
</template>
