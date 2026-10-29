<script setup lang="ts">
// 목업 chip(x) — Step·Solution 안의 근거 배지. 누르면 Case 근거 목록의 그 줄로 이동.
import { computed } from 'vue'
import GhEvIcon from './GhEvIcon.vue'
import { ciLabel, kindName, shortRef, statusName, useCaseGithub, type GhViewItem } from '@/composables/useCaseGithub'

const props = defineProps<{ item: GhViewItem }>()
const g = useCaseGithub()
const x = computed(() => props.item)
const ci = computed(() => ciLabel(x.value))
</script>

<template>
  <span v-if="x.masked" class="evidence-chip static"><GhEvIcon name="lock" size="xs" />비공개 {{ kindName(x) }} · {{ statusName(x.status) }}</span>
  <button v-else class="evidence-chip" :class="[`kind-${x.kind === 'ISSUE' ? 'issue' : 'pr'}`, `status-${x.status.toLowerCase()}`]" :title="`${x.title} — 연결된 근거로 이동`" @click="g.jumpEvidence(x.id)"><GhEvIcon :name="x.kind === 'ISSUE' ? 'issue' : 'pr'" size="xs" /><span>{{ shortRef(x) }} · <span class="gh-ref-state">{{ statusName(x.status) }}</span></span><span v-if="ci" class="chip-ci" :class="ci.cls">· {{ ci.label }}</span></button>
</template>
