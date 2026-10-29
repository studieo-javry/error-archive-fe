<script setup lang="ts">
// error_archive_github_link_checkbox_aligned.html 의 <symbol>·glyphs 를 경로 그대로 옮김(목업 icon(name, cls)).
export type GhEvIconName =
  | 'github' | 'issue' | 'pr' | 'link' | 'lock' | 'external' | 'chevron' | 'info' | 'alert' | 'clock'
  | 'check' | 'close' | 'eye' | 'plus' | 'arrow' | 'history' | 'users' | 'refresh'

withDefaults(defineProps<{ name: GhEvIconName; size?: 'sm' | 'xs' | '' }>(), { size: 'sm' })
</script>

<template>
  <svg class="svg" :class="[size, { github: name === 'github' }]" aria-hidden="true" viewBox="0 0 24 24">
    <path v-if="name === 'github'" d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.62 1.22 3.26.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.54 0-1.22.44-2.22 1.16-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.08 1.15a10.74 10.74 0 0 1 5.61 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.54.23 2.68.11 2.96.72.78 1.16 1.78 1.16 3 0 4.3-2.64 5.25-5.15 5.53.4.35.76 1.03.76 2.08v3.1c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z" />
    <template v-else-if="name === 'issue'"><circle cx="12" cy="12" r="9" /><path d="M12 8v5m0 3v.1" /></template>
    <template v-else-if="name === 'pr'"><circle cx="6" cy="3" r="2" /><circle cx="6" cy="21" r="2" /><circle cx="18" cy="19" r="2" /><path d="M6 5v14M18 17v-8a4 4 0 0 0-4-4h-3m3 0 2-2m-2 2 2 2" /></template>
    <path v-else-if="name === 'link'" d="M10 14 14 10M8 17l-2 2a5 5 0 0 1-7-7l4-4a5 5 0 0 1 7 0m4-1 3-3a5 5 0 0 1 7 7l-4 4a5 5 0 0 1-7 0" transform="translate(1 0) scale(.95)" />
    <template v-else-if="name === 'lock'"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></template>
    <path v-else-if="name === 'external'" d="M14 3h7v7m0-7L10 14M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
    <path v-else-if="name === 'chevron'" d="m6 9 6 6 6-6" />
    <template v-else-if="name === 'info'"><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></template>
    <path v-else-if="name === 'alert'" d="m12 3 10 18H2Zm0 6v5m0 3v.1" />
    <template v-else-if="name === 'clock'"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></template>
    <path v-else-if="name === 'check'" d="m5 12 4 4L19 6" />
    <path v-else-if="name === 'close'" d="M6 6 18 18M18 6 6 18" />
    <template v-else-if="name === 'eye'"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></template>
    <path v-else-if="name === 'plus'" d="M12 5v14M5 12h14" />
    <path v-else-if="name === 'arrow'" d="M4 12h16m-6-6 6 6-6 6" />
    <path v-else-if="name === 'history'" d="M3 7v5h5M4 12a8 8 0 1 1 2 5m6-9v5l4 2" />
    <template v-else-if="name === 'users'"><circle cx="9" cy="7" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2ZM16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2h-3" /></template>
    <path v-else-if="name === 'refresh'" d="M20 4v6h-6m6-1a8 8 0 1 0 0 7" />
  </svg>
</template>
