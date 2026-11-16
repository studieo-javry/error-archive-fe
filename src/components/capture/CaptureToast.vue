<script setup lang="ts">
import { useCaptureToast } from '@/composables/useCaptureToast'
import CapIcon from './CapIcon.vue'

const { message } = useCaptureToast()
</script>

<template>
  <Teleport to="body">
    <Transition name="cap-toast-fade">
      <div v-if="message" class="cap-toast" role="status" aria-live="polite">
        <CapIcon name="check" />{{ message }}
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cap-toast-fade-enter-active,
.cap-toast-fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.cap-toast-fade-enter-from,
.cap-toast-fade-leave-to { opacity: 0; transform: translate(-50%, 8px); }
</style>
