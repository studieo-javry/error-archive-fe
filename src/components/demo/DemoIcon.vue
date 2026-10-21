<script setup lang="ts">
// 목업의 icon() 헬퍼와 동일한 아이콘 패스(line-icon). .demo-ui .icon 스타일을 받는다.
const PATHS: Record<string, string> = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6 6-2Z"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  bulb: '<path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  checkcircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  reset: '<path d="M3 4v6h6M3 10a9 9 0 1 1 2 8"/>',
  file: '<path d="M5 3h9l5 5v13H5ZM14 3v6h5M9 13h6M9 17h6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="3.5" ry="9"/><path d="M3 12h18M5 7.5h14M5 16.5h14"/>',
}
defineProps<{ name: string }>()
</script>

<template>
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" v-html="PATHS[name] ?? ''" />
</template>
