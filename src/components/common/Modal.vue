<script setup lang="ts">
defineProps<{ show: boolean; title?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/40" @click="emit('close')" />
        <div class="relative bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
          <h3 v-if="title" class="text-lg font-semibold mb-4 dark:text-zinc-100">{{ title }}</h3>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
