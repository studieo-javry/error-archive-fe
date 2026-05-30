<script setup lang="ts">
import { ref } from 'vue'
import type { StepStatus } from '@/types/error'

const emit = defineEmits<{ submit: [data: { content: string; status: StepStatus; failureReason?: string }] }>()

const content = ref('')
const status = ref<StepStatus>('FAILED')
const failureReason = ref('')

function onSubmit() {
  if (!content.value.trim()) return
  emit('submit', {
    content: content.value,
    status: status.value,
    failureReason: status.value === 'FAILED' ? failureReason.value : undefined,
  })
  content.value = ''
  failureReason.value = ''
}
</script>

<template>
  <form id="add-step-form" class="mt-6 space-y-3" @submit.prevent="onSubmit">
    <input
      v-model="content"
      type="text"
      placeholder="What did you try?"
      class="raw-input w-full text-sm"
    />
    <div class="flex items-center gap-4">
      <select
        v-model="status"
        class="raw-input text-xs pr-6"
      >
        <option value="FAILED">Failed</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="RESOLVED">Resolved</option>
      </select>
      <button
        type="submit"
        class="px-4 py-1.5 text-xs font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
      >
        Add Step
      </button>
    </div>
    <textarea
      v-if="status === 'FAILED'"
      v-model="failureReason"
      placeholder="Why did it fail? (optional)"
      rows="2"
      class="raw-textarea w-full"
    />
  </form>
</template>
