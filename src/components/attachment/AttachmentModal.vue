<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{
  save: [data: { title?: string; caption?: string; file: File }]
  close: []
}>()

const title = ref('')
const caption = ref('')
const file = ref<File | null>(null)
const previewUrl = ref<string | null>(null)

const isImage = computed(() => file.value?.type.startsWith('image/') ?? false)

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const selected = input.files?.[0]
  if (!selected) return
  if (selected.size > 10 * 1024 * 1024) {
    alert('File size must be under 10MB')
    return
  }
  file.value = selected
  if (selected.type.startsWith('image/')) {
    previewUrl.value = URL.createObjectURL(selected)
  } else {
    previewUrl.value = null
  }
}

function onSubmit() {
  if (!file.value) return
  emit('save', {
    title: title.value.trim() || undefined,
    caption: caption.value.trim() || undefined,
    file: file.value,
  })
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="emit('close')">
    <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-100 mb-4">Add Attachment</h2>
        <form class="space-y-4" @submit.prevent="onSubmit">
          <input v-model="title" type="text" placeholder="Title (optional)" class="raw-input w-full text-sm" />
          <div>
            <label class="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">File *</label>
            <input type="file" class="text-sm text-zinc-600 dark:text-zinc-400" @change="onFileChange" />
            <p class="text-[11px] text-zinc-400 mt-1">Max 10MB per file</p>
          </div>
          <div v-if="previewUrl && isImage" class="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
            <img :src="previewUrl" alt="Preview" class="max-h-48 w-full object-contain bg-zinc-50 dark:bg-zinc-800" />
          </div>
          <div v-else-if="file" class="px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
            {{ file.name }} ({{ (file.size / 1024).toFixed(1) }}KB)
          </div>
          <input v-model="caption" type="text" placeholder="Caption (optional)" class="raw-input w-full text-sm" />
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" class="px-4 py-2 text-sm rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 transition-colors" @click="emit('close')">Cancel</button>
            <button type="submit" :disabled="!file" class="px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">Upload</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
