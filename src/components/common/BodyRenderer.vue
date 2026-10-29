<script setup lang="ts">
import { computed } from 'vue'
import type { ErrorCaseSnippet, ErrorCaseAttachment } from '@/types/error'
import SnippetInline from '@/components/snippet/SnippetInline.vue'
import AttachmentInline from '@/components/attachment/AttachmentInline.vue'
import MarkdownBody from '@/components/common/MarkdownBody.vue'
import { setTaskChecked } from '@/utils/markdownTasks'

const props = defineProps<{
  content: string
  snippets: ErrorCaseSnippet[]
  attachments: ErrorCaseAttachment[]
  editable?: boolean
  /** 주면 본문 작업 목록 체크박스를 눌러 저장할 수 있다 — 바뀐 본문 전체를 저장하는 함수. */
  onSaveContent?: (content: string) => Promise<unknown>
}>()
const emit = defineEmits<{ resize: [markerId: string, width: number] }>()

/** start/end = 원문(content)에서의 위치 — 체크박스 저장 시 이 구간만 바꿔 끼운다. */
interface TextSegment { type: 'text'; value: string; start: number; end: number }
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
      result.push({ type: 'text', value: props.content.slice(lastIndex, match.index), start: lastIndex, end: match.index })
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
    result.push({ type: 'text', value: props.content.slice(lastIndex), start: lastIndex, end: props.content.length })
  }

  return result
})

function toggleTask(seg: TextSegment) {
  return async (index: number, checked: boolean) => {
    const next = setTaskChecked(seg.value, index, checked)
    if (next == null || !props.onSaveContent) return
    await props.onSaveContent(props.content.slice(0, seg.start) + next + props.content.slice(seg.end))
  }
}
</script>

<template>
  <div class="body-renderer">
    <template v-for="(seg, i) in segments" :key="i">
      <MarkdownBody v-if="seg.type === 'text'" :content="seg.value" class="!text-sm" :on-toggle-task="onSaveContent ? toggleTask(seg) : undefined" />
      <SnippetInline v-else-if="seg.type === 'snippet'" :snippet="seg.snippet" />
      <AttachmentInline v-else :attachment="seg.attachment" :width="seg.width" :editable="editable" @resize="(id, w) => emit('resize', id, w)" />
    </template>
  </div>
</template>
