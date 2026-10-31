<script setup lang="ts">
// 목업 openModal(title, body, footer, wide) — 네이티브 <dialog>(showModal) + modal-heading/modal-footer.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import GhEvIcon from './GhEvIcon.vue'

defineProps<{ title: string; wide?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const el = ref<HTMLDialogElement | null>(null)
const previousFocus = document.activeElement as HTMLElement | null

onMounted(() => el.value?.showModal())
onBeforeUnmount(() => {
  if (el.value?.open) el.value.close()
  if (previousFocus?.isConnected) previousFocus.focus()
})
// Esc 로 닫힘(cancel) — 상태도 닫는다.
function onCancel(e: Event) {
  e.preventDefault()
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="gh-ev">
      <dialog ref="el" :class="{ wide }" aria-labelledby="modal-title" @cancel="onCancel">
        <div class="modal-heading"><h2 id="modal-title">{{ title }}</h2><button class="icon-btn" aria-label="닫기" @click="emit('close')"><GhEvIcon name="close" size="sm" /></button></div>
        <slot />
        <div v-if="$slots.footer" class="modal-footer"><slot name="footer" /></div>
      </dialog>
    </div>
  </Teleport>
</template>
