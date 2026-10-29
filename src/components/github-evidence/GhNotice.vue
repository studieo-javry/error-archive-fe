<script setup lang="ts">
// 목업 notice(msg, cls, i)
import GhEvIcon, { type GhEvIconName } from './GhEvIcon.vue'

withDefaults(defineProps<{ cls?: string; icon?: GhEvIconName; role?: string }>(), { cls: '', icon: 'info', role: undefined })
</script>

<template>
  <div class="gh-notice" :class="cls" :role="role"><GhEvIcon :name="icon" size="sm" /><div><slot /></div></div>
</template>
