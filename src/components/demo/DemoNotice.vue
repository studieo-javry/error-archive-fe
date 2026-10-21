<script setup lang="ts">
import DemoIcon from '@/components/demo/DemoIcon.vue'
</script>

<template>
  <!-- 목업의 .demo-notice — 게스트에게 "이 화면은 저장되지 않는 데모"임을 알리는 안내 박스. 여백은 호출부에서. -->
  <div class="demo-notice" role="note">
    <DemoIcon name="info" />
    <span><slot /></span>
  </div>
</template>
