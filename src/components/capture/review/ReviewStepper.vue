<script setup lang="ts">
// 검토 → 미리보기 → 완료 3단계 인디케이터.
defineProps<{ step: 'review' | 'preview' }>()
</script>

<template>
  <div class="stepper">
    <span class="circle" :class="{ current: step === 'review' }">{{ step === 'preview' ? '✓' : '1' }}</span>
    <span>내용 검토</span>
    <span class="dash" />
    <span class="circle" :class="{ current: step === 'preview' }">2</span>
    <span>반영 미리보기</span>
    <span class="dash" />
    <span class="circle">3</span>
    <span>완료</span>
  </div>
</template>
