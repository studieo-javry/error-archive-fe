<script setup lang="ts">
import { computed, watch, onBeforeUnmount } from 'vue'
import { useTour } from '@/composables/useTour'
import DemoIcon from '@/components/demo/DemoIcon.vue'

// 04 단계 — 발행물을 새 탭 대신 앱 안에서 보여주는 리더 오버레이.
// 내용은 재구현이 아니라 실제 공개 페이지(`/p/{slug}`)를 iframe 으로 임베드한 "진짜 발행물".
// (same-origin 이라 FE worker 가 /p/* 응답의 X-Frame-Options 를 풀고 frame-ancestors 'self' 로 허용.)
const { article, articleOpen, closeArticle, next } = useTour()

const displayUrl = computed(() => article.value?.publicUrl.replace(/^https?:\/\//, '') ?? '')

function finish() {
  closeArticle()
  next()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeArticle()
}
watch(articleOpen, (open) => {
  if (open) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="articleOpen && article" class="demo-ui">
    <div
      class="guide-reader-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="발행된 아티클"
      @mousedown.self="closeArticle"
    >
      <div class="guide-reader">
        <header class="reader-chrome">
          <span class="reader-dots" aria-hidden="true"><i /><i /><i /></span>
          <div class="reader-addr mono"><DemoIcon name="globe" /><span>{{ displayUrl }}</span></div>
          <div class="reader-actions">
            <a class="btn btn-quiet" :href="article.publicUrl" target="_blank" rel="noopener">
              <DemoIcon name="arrow" />새 탭에서 열기
            </a>
            <button type="button" class="icon-btn" aria-label="리더 닫기" @click="closeArticle">
              <DemoIcon name="close" />
            </button>
          </div>
        </header>

        <div class="reader-body">
          <iframe :src="article.publicUrl" title="발행된 아티클" referrerpolicy="no-referrer" />
        </div>

        <footer class="reader-foot">
          <div class="reader-foot-note">
            <span class="pill pill-green">04 · 발행된 글</span>
            <span>작업 기록이 이렇게 공개 글이 됩니다.</span>
          </div>
          <button type="button" class="btn btn-primary" @click="finish"><DemoIcon name="check" />가이드 마치기</button>
        </footer>
      </div>
    </div>
  </div>
</template>
