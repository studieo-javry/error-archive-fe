<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { StepStatus, Step } from '@/types/error'

/** Raw field values — the caller maps them to a create or update request. */
export interface StepFormValues {
  title: string
  status: StepStatus
  /** null = no type / cleared */
  attemptType: string | null
  body: string
  insight: string
}

const props = defineProps<{
  /** present = editing that step; absent = creating a new one */
  initial?: Step | null
  submitLabel?: string
}>()

const emit = defineEmits<{ submit: [values: StepFormValues]; cancel: [] }>()

const isEdit = computed(() => Boolean(props.initial))

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

const resolvedAttemptType = computed<string | null>(() => {
  if (isCustom.value) return customAttemptType.value.trim() || null
  return attemptTypeSelect.value || null
})

function reset() {
  title.value = ''
  status.value = 'FAILED'
  attemptTypeSelect.value = ''
  customAttemptType.value = ''
  body.value = ''
  insight.value = ''
}

// Seed the fields when editing. An attempt type the picker doesn't know about
// (users may type their own) falls back to the custom slot.
watch(
  () => props.initial,
  (step) => {
    if (!step) {
      reset()
      return
    }
    title.value = step.title
    status.value = step.status
    body.value = step.body ?? ''
    insight.value = step.insight ?? ''
    if (step.attemptType && attemptTypes.some(t => t.value === step.attemptType)) {
      attemptTypeSelect.value = step.attemptType
      customAttemptType.value = ''
    } else if (step.attemptType) {
      attemptTypeSelect.value = '__custom__'
      customAttemptType.value = step.attemptType
    } else {
      attemptTypeSelect.value = ''
      customAttemptType.value = ''
    }
  },
  { immediate: true },
)

function onSubmit() {
  if (!title.value.trim()) return
  emit('submit', {
    title: title.value,
    status: status.value,
    attemptType: resolvedAttemptType.value,
    body: body.value,
    insight: insight.value,
  })
  // editing keeps the values on screen until the parent closes the form
  if (!isEdit.value) reset()
}
</script>

<template>
  <form
    :id="isEdit ? undefined : 'add-step-form'"
    class="space-y-3"
    :class="isEdit ? 'mt-1' : 'mt-6'"
    @submit.prevent="onSubmit"
  >
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
      <div class="ml-auto flex items-center gap-3">
        <button
          v-if="isEdit"
          type="button"
          class="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          @click="emit('cancel')"
        >Cancel</button>
        <button
          type="submit"
          class="px-4 py-1.5 text-xs font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        >
          {{ submitLabel || (isEdit ? 'Save' : 'Add Step') }}
        </button>
      </div>
    </div>
    <textarea
      v-model="body"
      placeholder="Details — what happened, what you observed (markdown supported)"
      rows="5"
      class="raw-textarea w-full text-sm !resize-y"
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
