<script setup lang="ts">
import type { Comment } from '@/types/error'
import CommentItem from './CommentItem.vue'
import type { QuoteInfo } from './CommentForm.vue'

defineProps<{
  comments: Comment[]
  caseOwnerUserId: number
  stepIndexMap?: Map<number, number>
}>()

defineEmits<{
  reply: [parentId: number, body: string, quote: QuoteInfo | null]
  edit: [commentId: number, body: string]
  delete: [commentId: number]
  helpful: [commentId: number]
  scrollToQuote: [kind: string, sourceId: number | null]
}>()
</script>

<template>
  <div class="divide-y divide-zinc-200 dark:divide-zinc-800">
    <CommentItem
      v-for="comment in comments"
      :key="comment.id"
      :comment="comment"
      :case-owner-user-id="caseOwnerUserId"
      :step-index-map="stepIndexMap"
      @reply="(parentId, body, quote) => $emit('reply', parentId, body, quote)"
      @edit="(id, body) => $emit('edit', id, body)"
      @delete="(id) => $emit('delete', id)"
      @helpful="(id) => $emit('helpful', id)"
      @scroll-to-quote="(kind, sourceId) => $emit('scrollToQuote', kind, sourceId)"
    />
  </div>
</template>
