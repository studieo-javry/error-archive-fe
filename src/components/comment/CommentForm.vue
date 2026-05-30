<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ submit: [content: string] }>()
const content = ref('')

function onSubmit() {
  if (!content.value.trim()) return
  emit('submit', content.value)
  content.value = ''
}
</script>

<template>
  <form class="flex gap-2" @submit.prevent="onSubmit">
    <input
      v-model="content"
      type="text"
      placeholder="Write a comment..."
      class="raw-input flex-1 text-sm"
    />
    <button
      type="submit"
      class="px-3 py-1.5 text-xs font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
    >
      Post
    </button>
  </form>
</template>
