<script setup lang="ts">
import { computed } from 'vue'
import type { ErrorCaseSnippet, ErrorCaseAttachment } from '@/types/error'
import SnippetInline from '@/components/snippet/SnippetInline.vue'
import AttachmentInline from '@/components/attachment/AttachmentInline.vue'
import MarkdownBody from '@/components/common/MarkdownBody.vue'

const props = defineProps<{
  content: string
  snippets: ErrorCaseSnippet[]
  attachments: ErrorCaseAttachment[]
  editable?: boolean
}>()
const emit = defineEmits<{ resize: [markerId: string, width: number] }>()

interface TextSegment { type: 'text'; value: string }
interface SnippetSegment { type: 'snippet'; id: string; snippet: ErrorCaseSnippet | null }
interface AttachmentSegment { type: 'attachment'; id: string; width?: number; attachment: ErrorCaseAttachment | null }
type Segment = TextSegment | SnippetSegment | AttachmentSegment

const segments = computed<Segment[]>(() => {
  // @attach markers may carry a display width: @attach(markerId|400)
  const pattern = /@(snippet|attach)\(([a-zA-Z0-9_-]+)(?:\|(\d{2,4}))?\)/g
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
      const width = match[3] ? Number(match[3]) : undefined
      result.push({ type: 'attachment', id, width, attachment: props.attachments.find(a => a.markerId === id) ?? null })
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
      <MarkdownBody v-if="seg.type === 'text'" :content="seg.value" class="!text-sm" />
      <SnippetInline v-else-if="seg.type === 'snippet'" :snippet="seg.snippet" />
      <AttachmentInline v-else :attachment="seg.attachment" :width="seg.width" :editable="editable" @resize="(id, w) => emit('resize', id, w)" />
    </template>
  </div>
</template>
