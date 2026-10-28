<script setup lang="ts">
// error-archive-github-p0-mockup.html 의 <symbol> 들을 경로 그대로 옮김.
export type GhIconName =
  | 'github' | 'plus' | 'users' | 'user' | 'chevron' | 'repo' | 'building' | 'lock' | 'shield'
  | 'link' | 'external' | 'check' | 'close' | 'info' | 'alert' | 'refresh' | 'search' | 'arrow' | 'pause'

defineProps<{ name: GhIconName }>()
</script>

<template>
  <svg class="icon" :class="{ github: name === 'github' }" viewBox="0 0 24 24" aria-hidden="true">
    <path v-if="name === 'github'" d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.62 1.22 3.26.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.54 0-1.22.44-2.22 1.16-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.08 1.15a10.74 10.74 0 0 1 5.61 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.54.23 2.68.11 2.96.72.78 1.16 1.78 1.16 3 0 4.3-2.64 5.25-5.15 5.53.4.35.76 1.03.76 2.08v3.1c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z" />
    <path v-else-if="name === 'plus'" d="M12 5v14M5 12h14" />
    <template v-else-if="name === 'users'"><circle cx="9" cy="7" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2ZM16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2h-3" /></template>
    <template v-else-if="name === 'user'"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></template>
    <path v-else-if="name === 'chevron'" d="m8 5 7 7-7 7" />
    <path v-else-if="name === 'repo'" d="M5 4a2 2 0 0 1 2-2h13v17H7a2 2 0 0 0 0 4h13M5 4v17M9 6h7M9 10h4" />
    <path v-else-if="name === 'building'" d="M4 21V3h12v18M16 10h4v11M2 21h20M8 7h4m-4 4h4m-4 4h4m-3 6v-3h2v3" />
    <template v-else-if="name === 'lock'"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></template>
    <path v-else-if="name === 'shield'" d="m12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5Zm-4 9 3 3 5-6" />
    <path v-else-if="name === 'link'" d="m10 14 4-4m-5 8-2 2a5 5 0 0 1-7-7l4-4a5 5 0 0 1 7 0m2-3 2-2a5 5 0 0 1 7 7l-4 4a5 5 0 0 1-7 0" transform="translate(1 0) scale(.95)" />
    <path v-else-if="name === 'external'" d="M14 3h7v7m0-7L10 14M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
    <path v-else-if="name === 'check'" d="m5 12 4 4L19 6" />
    <path v-else-if="name === 'close'" d="m6 6 12 12M6 18 18 6" />
    <template v-else-if="name === 'info'"><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></template>
    <path v-else-if="name === 'alert'" d="m12 3 10 18H2Zm0 6v5m0 3v.1" />
    <path v-else-if="name === 'refresh'" d="M20 4v6h-6m6-1a8 8 0 1 0 0 7" />
    <template v-else-if="name === 'search'"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></template>
    <path v-else-if="name === 'arrow'" d="M4 12h16m-6-6 6 6-6 6" />
    <path v-else-if="name === 'pause'" d="M8 5v14M16 5v14" />
  </svg>
</template>
