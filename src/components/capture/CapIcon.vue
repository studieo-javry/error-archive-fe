<script setup lang="ts">
// Agent Capture 화면 공용 아이콘 — 목업 paths 딕셔너리 포팅(단일 path, stroke 기반 24x24).
const PATHS: Record<string, string> = {
  home: 'M3 10l9-7 9 7M5 9v11h5v-6h4v6h5V9',
  book: 'M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15',
  inbox: 'M4 4h16l2 11v5H2v-5L4 4Zm-2 11h6l2 3h4l2-3h6M8 9h8M9 6h6',
  plus: 'M12 5v14M5 12h14',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  chart: 'M5 20V10M12 20V4M19 20v-7',
  settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Zm6 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  back: 'M19 12H5l5-5m-5 5 5 5',
  close: 'M6 6l12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  lock: 'M5 11h14v10H5V11Zm3 0V7a4 4 0 0 1 8 0v4',
  refresh: 'M20 7V2m0 5h-5M4 17v5m0-5h5M20 7a8 8 0 0 0-14-2M4 17a8 8 0 0 0 14 2',
  folder: 'M3 6h7l2 2h9v12H3V6Z',
  file: 'M6 2h8l4 4v16H6V2Zm8 0v5h4M9 12h6M9 16h6',
  image: 'M3 3h18v18H3V3Zm0 14 6-6 4 4 3-3 5 5M16 7h.01',
  terminal: 'm5 7 5 5-5 5m8 0h6',
  help: 'M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  copy: 'M9 8h11v13H9V8Zm-5 8H3V3h11v1',
  edit: 'm15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z',
  up: 'm6 14 6-6 6 6',
  down: 'm6 10 6 6 6-6',
  link: 'm9 15 6-6M7 17l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M17 7l1-1a4 4 0 0 0-6-6L8 4a4 4 0 0 0 0 6',
  device: 'M3 3h18v13H3V3Zm5 18h8m-4-5v5',
  alert: 'm12 3 10 18H2L12 3Zm0 6v5m0 3h.01',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
}

const props = defineProps<{ name: string }>()
const d = (): string => PATHS[props.name] ?? PATHS.file
</script>

<template>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="d()" /></svg>
</template>
