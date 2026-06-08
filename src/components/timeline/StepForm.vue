<script setup lang="ts">
import { ref, computed } from 'vue'
import type { StepStatus, StepCreateRequest } from '@/types/error'

const emit = defineEmits<{ submit: [data: StepCreateRequest] }>()

const title = ref('')
const status = ref<StepStatus>('FAILED')
const attemptTypeSelect = ref('')
const customAttemptType = ref('')
const body = ref('')
const insight = ref('')

const attemptTypes = [
  { value: 'CODE_CHANGE', label: 'Code Change' },
  { value: 'CONFIG', label: 'Config' },
  { value: 'DEPENDENCY', label: 'Dependency' },
  { value: 'ENV', label: 'Environment' },
  { value: 'ROLLBACK', label: 'Rollback' },
  { value: 'INVESTIGATION', label: 'Investigation' },
  { value: 'OTHER', label: 'Other' },
]

const isCustom = computed(() => attemptTypeSelect.value === '__custom__')

const resolvedAttemptType = computed(() => {
  if (isCustom.value) return customAttemptType.value.trim() || undefined
  return attemptTypeSelect.value || undefined
})

function onSubmit() {
  if (!title.value.trim()) return
  emit('submit', {
    title: title.value,
    status: status.value,
    attemptType: resolvedAttemptType.value || undefined,
    body: body.value || undefined,
    insight: insight.value || undefined,
  })
  title.value = ''
  body.value = ''
  insight.value = ''
  attemptTypeSelect.value = ''
  customAttemptType.value = ''
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
        <option value="FAILED">Failed</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="RESOLVED">Resolved</option>
      </select>
      <select v-model="attemptTypeSelect" class="raw-input text-xs pr-6">
        <option value="">Type (optional)</option>
        <option v-for="at in attemptTypes" :key="at.value" :value="at.value">{{ at.label }}</option>
        <option value="__custom__">Custom…</option>
      </select>
      <input
        v-if="isCustom"
        v-model="customAttemptType"
        type="text"
        placeholder="Custom type"
        class="raw-input text-xs w-28"
      />
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
