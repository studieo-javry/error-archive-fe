<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useTour } from '@/composables/useTour'
import { useTeamStore } from '@/stores/teamStore'
import DemoIcon from '@/components/demo/DemoIcon.vue'

const router = useRouter()
const teamStore = useTeamStore()
const { start: startTour } = useTour()

function freeBrowse() {
  router.push({ name: 'errorList', params: { slug: teamStore.currentSlug } })
}
</script>

<template>
  <div class="demo-ui">
    <section class="welcome" aria-labelledby="welcome-title">
      <div>
        <div class="welcome-meta">
          <DemoIcon name="compass" /><span>A LITTLE GUIDANCE</span><span>약 3분 · 4단계</span>
        </div>
        <h2 id="welcome-title">하나의 에러가<br>해결 기록이 되기까지.</h2>
        <p>샘플 케이스 하나를 따라가며 시도를 남기고, 솔루션을 찾고, 글로 공유하는 흐름을 살펴보세요.</p>
        <div class="action-row">
          <button type="button" class="btn btn-primary" @click="startTour"><DemoIcon name="arrow" />가이드 시작하기</button>
          <button type="button" class="btn btn-quiet" @click="freeBrowse">자유롭게 둘러보기</button>
        </div>
      </div>
      <ol class="welcome-steps">
        <li><span class="step-num mono">01</span>에러의 맥락 읽기</li>
        <li><span class="step-num mono">02</span>시도와 결과 따라가기</li>
        <li><span class="step-num mono">03</span>해결의 근거 모아보기</li>
        <li><span class="step-num mono"><DemoIcon name="check" /></span>하나의 글로 이어가기</li>
      </ol>
    </section>
  </div>
</template>
