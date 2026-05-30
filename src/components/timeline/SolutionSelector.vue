<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ selectedCount: number; active: boolean }>()
const emit = defineEmits<{ toggle: []; create: [name: string, rootCause: string] }>()

const name = ref('')
const rootCause = ref('')

function onSubmit() {
  if (!name.value.trim() || props.selectedCount === 0) return
  emit('create', name.value, rootCause.value)
  name.value = ''
  rootCause.value = ''
}
</script>

<template>
  <div>
    <button
      class="px-4 py-2 text-xs font-medium rounded-xl transition-colors"
      :class="active
        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'"
      @click="emit('toggle')"
    >
      {{ active ? 'Cancel Selection' : 'Create Solution' }}
    </button>

    <Transition name="slide">
      <div
        v-if="active && selectedCount > 0"
        class="fixed bottom-0 left-20 right-0 bg-white dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 p-4 shadow-lg z-30"
      >
        <form class="flex items-center gap-4 max-w-2xl mx-auto" @submit.prevent="onSubmit">
          <span class="text-xs text-zinc-500 whitespace-nowrap">{{ selectedCount }} steps selected</span>
          <input v-model="name" placeholder="Solution name" class="raw-input flex-1 text-sm" />
          <input v-model="rootCause" placeholder="Root cause" class="raw-input flex-1 text-sm" />
          <button type="submit" class="px-4 py-1.5 text-xs font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors whitespace-nowrap">
            Save Solution
          </button>
        </form>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-enter-active, .slide-leave-active { transition: transform 0.3s ease; }
.slide-enter-from, .slide-leave-to { transform: translateY(100%); }
</style>
