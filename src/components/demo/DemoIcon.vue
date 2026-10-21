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
  // 공개 공간 안내용(목업 인라인 svg) — 자오선 하나짜리 단순한 지구본.
  meridian: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
  library: '<path d="M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z"/><path d="M12 6v15"/>',
  link: '<path d="m10 14 4-4m-6 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2-1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(2 0) scale(.9)"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8.2v5M12 16.2v.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16"/>',
}
defineProps<{ name: string }>()
</script>

<template>
  <!-- presentation 속성은 .demo-ui 밖(데모 안내 박스·스텝 폼)에서 쓰일 때의 기본값. .demo-ui .icon CSS 가 있으면 그쪽이 우선. -->
  <svg
    class="icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="PATHS[name] ?? ''"
  />
</template>
