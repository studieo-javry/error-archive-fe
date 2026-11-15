<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import CapIcon from './CapIcon.vue'

// 캡처 화면 공용 모달 — 목업 showModal 재현(오버레이·ESC·포커스 트랩·footer 슬롯). 큰 편집 모달 지원.
const props = defineProps<{ show: boolean; title: string; large?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const card = ref<HTMLElement | null>(null)
let returnFocus: HTMLElement | null = null

function focusable(): HTMLElement[] {
  if (!card.value) return []
  return [...card.value.querySelectorAll<HTMLElement>(
    'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]',
  )].filter((el) => el.offsetParent !== null)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
    return
  }
  if (e.key === 'Tab') {
    const els = focusable()
    if (!els.length) return
    const first = els[0]
    const last = els[els.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

watch(
  () => props.show,
  (open) => {
    if (open) {
      returnFocus = document.activeElement as HTMLElement | null
      document.addEventListener('keydown', onKeydown)
      nextTick(() => {
        const first = card.value?.querySelector<HTMLElement>('input:not([type=checkbox]),textarea,select')
        ;(first ?? focusable()[0])?.focus()
      })
    } else {
      document.removeEventListener('keydown', onKeydown)
      if (returnFocus?.isConnected) returnFocus.focus()
    }
  },
)

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="cap-modal-fade">
      <div v-if="show" class="cap-overlay cap" @click.self="emit('close')">
        <section
          ref="card"
          class="cap-modal"
          :class="{ large }"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <div class="modal-head">
            <h2>{{ title }}</h2>
            <button type="button" class="iconbtn" aria-label="닫기" @click="emit('close')"><CapIcon name="close" /></button>
          </div>
          <slot />
          <div v-if="$slots.footer" class="modal-footer"><slot name="footer" /></div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cap-modal-fade-enter-active,
.cap-modal-fade-leave-active { transition: opacity 0.18s; }
.cap-modal-fade-enter-from,
.cap-modal-fade-leave-to { opacity: 0; }
</style>
