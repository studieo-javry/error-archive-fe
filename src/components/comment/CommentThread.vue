<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Comment, CommentAuthor } from '@/types/error'
import CommentItem from './CommentItem.vue'
import MentionHoverCard from './MentionHoverCard.vue'
import type { QuoteInfo } from './CommentForm.vue'

const props = defineProps<{
  comments: Comment[]
  caseId: number
  caseOwnerUserId: number
  stepIndexMap?: Map<number, number>
  authorMap?: Map<number, CommentAuthor>
}>()

defineEmits<{
  reply: [parentId: number, body: string, quote: QuoteInfo | null]
  edit: [commentId: number, body: string]
  delete: [commentId: number]
  helpful: [commentId: number]
  scrollToQuote: [kind: string, sourceId: number | null]
}>()

// 멘션 프로필 카드 — 이 댓글 영역 안의 멘션 전부를 카드 한 장이 맡는다.
const threadEl = ref<HTMLElement | null>(null)
const commentCounts = computed(() => {
  const counts = new Map<number, number>()
  const walk = (list: Comment[]) => {
    for (const c of list) {
      if (!c.deletedAt) counts.set(c.authorUserId, (counts.get(c.authorUserId) ?? 0) + 1)
      if (c.replies?.length) walk(c.replies)
    }
  }
  walk(props.comments)
  return counts
})
</script>

<template>
  <div ref="threadEl" class="divide-y divide-zinc-200 dark:divide-zinc-800">
    <CommentItem
      v-for="comment in comments"
      :key="comment.id"
      :comment="comment"
      :case-id="caseId"
      :case-owner-user-id="caseOwnerUserId"
      :step-index-map="stepIndexMap"
      :author-map="authorMap"
      @reply="(parentId, body, quote) => $emit('reply', parentId, body, quote)"
      @edit="(id, body) => $emit('edit', id, body)"
      @delete="(id) => $emit('delete', id)"
      @helpful="(id) => $emit('helpful', id)"
      @scroll-to-quote="(kind, sourceId) => $emit('scrollToQuote', kind, sourceId)"
    />
    <MentionHoverCard :root="threadEl" :comment-counts="commentCounts" />
  </div>
</template>
