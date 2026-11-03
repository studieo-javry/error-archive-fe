<script setup lang="ts">
import { computed } from 'vue'

// 에러 상세 제목 아래 심각도 — 4단계 인디케이터(목업 error_archive_severity_fe_aligned_mockup C안). 값이 없으면 아무것도 그리지 않는다.
const props = defineProps<{ severity: number | null }>()

const levels: Record<number, string> = { 1: 'Outage', 2: 'Degraded', 3: 'Minor', 4: 'Info' }

const level = computed(() => (props.severity != null && levels[props.severity] ? props.severity : null))
</script>

<template>
  <div v-if="level" class="sev-after-title" :class="`sev-l${level}`">
    <div class="sev-indicator">
      <i v-for="i in 4" :key="i" :class="{ active: i === level }" :title="`S${i} · ${levels[i]}`" />
    </div>
    <span class="sev-reveal" :aria-label="`Severity S${level} ${levels[level]}`">
      <span class="sev-dot" aria-hidden="true" />
      <span class="sev-strong">S{{ level }}</span>
      <span class="sev-muted">· {{ levels[level] }}</span>
    </span>
  </div>
</template>

<style scoped>
.sev-l1 { --sev-ink: #e11d48 }
.sev-l2 { --sev-ink: #d97706 }
.sev-l3 { --sev-ink: #2563eb }
.sev-l4 { --sev-ink: #71717a }
.dark .sev-l1 { --sev-ink: #fb7185 }
.dark .sev-l2 { --sev-ink: #fbbf24 }
.dark .sev-l3 { --sev-ink: #60a5fa }
.dark .sev-l4 { --sev-ink: #a1a1aa }

.sev-after-title { display: flex; align-items: center; justify-content: center; gap: 11px; margin: -7px 0 22px; min-height: 18px }
.sev-indicator { display: inline-flex; align-items: center; gap: 3px; height: 10px }
.sev-indicator i { display: block; width: 26px; height: 5px; border-radius: 3px; background: #e4e4e7 }
.dark .sev-indicator i { background: #52525b }
.sev-indicator i.active { background: var(--sev-ink) }

.sev-reveal { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; gap: 5px; white-space: nowrap; letter-spacing: 0; font-family: Inter, "Pretendard Variable", Pretendard, system-ui, sans-serif; font-size: 11px }
.sev-reveal .sev-dot { display: block; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--sev-ink) }
.sev-reveal .sev-strong { font-weight: 600; color: var(--sev-ink) }
.sev-reveal .sev-muted { color: #71717a; font-weight: 400 }
.dark .sev-reveal .sev-muted { color: #a1a1aa }
</style>
