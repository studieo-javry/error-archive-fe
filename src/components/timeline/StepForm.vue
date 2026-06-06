<script setup lang="ts">
import { ref } from 'vue'
import type { StepStatus, AttemptType, StepCreateRequest } from '@/types/error'

const emit = defineEmits<{ submit: [data: StepCreateRequest] }>()

const title = ref('')
const status = ref<StepStatus>('FAILURE')
const attemptType = ref<AttemptType | ''>('')
const body = ref('')
const insight = ref('')

const attemptTypes: { value: AttemptType; label: string }[] = [
  { value: 'CODE_CHANGE', label: 'Code Change' },
  { value: 'CONFIG', label: 'Config' },
  { value: 'DEPENDENCY', label: 'Dependency' },
  { value: 'ENV', label: 'Environment' },
  { value: 'ROLLBACK', label: 'Rollback' },
  { value: 'INVESTIGATION', label: 'Investigation' },
  { value: 'OTHER', label: 'Other' },
]

function onSubmit() {
  if (!title.value.trim()) return
  emit('submit', {
    title: title.value,
    status: status.value,
    attemptType: attemptType.value || undefined,
    body: body.value || undefined,
    insight: insight.value || undefined,
  })
  title.value = ''
  body.value = ''
  insight.value = ''
  attemptType.value = ''
}
</script>

<template>
  <form id="add-step-form" class="mt-6 space-y-3" @submit.prevent="onSubmit">
    <input
      v-model="title"
      type="text"
      placeholder="What did you try?"
      class="raw-input w-full text-sm"
    />
    <div class="flex items-center gap-3">
      <select v-model="status" class="raw-input text-xs pr-6">
        <option value="FAILURE">Failed</option>
        <option value="PARTIAL">Partial</option>
        <option value="SUCCESS">Resolved</option>
      </select>
      <select v-model="attemptType" class="raw-input text-xs pr-6">
        <option value="">Type (optional)</option>
        <option v-for="at in attemptTypes" :key="at.value" :value="at.value">{{ at.label }}</option>
      </select>
      <button
        type="submit"
        class="ml-auto px-4 py-1.5 text-xs font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
      >
        Add Step
      </button>
    </div>
    <textarea
      v-model="body"
      placeholder="Details — what happened, what you observed (markdown supported)"
      rows="3"
      class="raw-textarea w-full text-sm"
    />
    <textarea
      v-model="insight"
      placeholder="Insight — key takeaway or summary (optional, max 500 chars)"
      rows="2"
      maxlength="500"
      class="raw-textarea w-full text-sm"
    />
  </form>
</template>
