<script setup lang="ts">
import { computed } from 'vue'
import type { ErrorCaseSnippet, ErrorCaseAttachment } from '@/types/error'
import SnippetInline from '@/components/snippet/SnippetInline.vue'
import AttachmentInline from '@/components/attachment/AttachmentInline.vue'

const props = defineProps<{
  content: string
  snippets: ErrorCaseSnippet[]
  attachments: ErrorCaseAttachment[]
}>()

interface TextSegment { type: 'text'; value: string }
interface SnippetSegment { type: 'snippet'; id: string; snippet: ErrorCaseSnippet | null }
interface AttachmentSegment { type: 'attachment'; id: string; attachment: ErrorCaseAttachment | null }
type Segment = TextSegment | SnippetSegment | AttachmentSegment

const segments = computed<Segment[]>(() => {
  const pattern = /@(snippet|attach)\(([a-zA-Z0-9_-]+)\)/g
  const result: Segment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(props.content)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'text', value: props.content.slice(lastIndex, match.index) })
    }
    const kind = match[1]
    const id = match[2]
    if (kind === 'snippet') {
      result.push({ type: 'snippet', id, snippet: props.snippets.find(s => s.markerId === id) ?? null })
    } else {
      result.push({ type: 'attachment', id, attachment: props.attachments.find(a => a.markerId === id) ?? null })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < props.content.length) {
    result.push({ type: 'text', value: props.content.slice(lastIndex) })
  }

  return result
})
</script>

<template>
  <div class="body-renderer">
    <template v-for="(seg, i) in segments" :key="i">
      <p v-if="seg.type === 'text'" class="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{{ seg.value }}</p>
      <SnippetInline v-else-if="seg.type === 'snippet'" :snippet="seg.snippet" />
      <AttachmentInline v-else :attachment="seg.attachment" />
    </template>
  </div>
</template>
