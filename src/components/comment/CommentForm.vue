<script setup lang="ts">
import { ref } from 'vue'
import type { QuoteSourceKind } from '@/types/error'

export interface QuoteInfo {
  kind: QuoteSourceKind
  sourceId: number | null
  snapshot: string
  label: string
}

const props = defineProps<{
  quote?: QuoteInfo | null
  initialBody?: string
  placeholder?: string
  submitLabel?: string
}>()

const emit = defineEmits<{
  submit: [body: string, quote: QuoteInfo | null]
  cancel: []
  clearQuote: []
}>()

const body = ref(props.initialBody ?? '')

function onSubmit() {
  if (!body.value.trim()) return
  emit('submit', body.value, props.quote ?? null)
  body.value = ''
  emit('clearQuote')
}
</script>

<template>
  <div>
    <div v-if="quote" class="mb-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-zinc-800/60 border-l-2 border-emerald-400">
      <div class="flex-1 min-w-0">
        <span class="text-[10px] font-medium text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">{{ quote.label }}</span>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2 italic">"{{ quote.snapshot }}"</p>
      </div>
      <button class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs shrink-0" @click="$emit('clearQuote')">&times;</button>
    </div>
    <form class="flex gap-2 items-end" @submit.prevent="onSubmit">
      <textarea
        v-model="body"
        :placeholder="placeholder || 'Share your thoughts. Drag text from the body or steps to quote it.'"
        rows="2"
        class="flex-1 text-sm bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 transition-colors resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-zinc-800 dark:text-zinc-200"
      />
      <div class="flex items-center gap-1.5 pb-1">
        <button
          v-if="initialBody"
          type="button"
          class="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          @click="$emit('cancel')"
        >Cancel</button>
        <button
          type="submit"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        >{{ submitLabel || 'Post' }}</button>
      </div>
    </form>
  </div>
</template>
