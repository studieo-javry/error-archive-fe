<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Comment, CommentAuthor } from '@/types/error'
import { timeAgo, formatAbsolute } from '@/utils/timeAgo'
import MarkdownBody from '@/components/common/MarkdownBody.vue'
import CommentForm from './CommentForm.vue'
import type { QuoteInfo } from './CommentForm.vue'

const props = defineProps<{
  comment: Comment
  caseOwnerUserId: number
  depth?: number
  stepIndexMap?: Map<number, number>
  authorMap?: Map<number, CommentAuthor>
}>()

// 작성자 이니셜(아바타 없을 때). displayName 첫 글자.
const authorInitial = computed(() => (props.comment.author?.displayName || '?').charAt(0).toUpperCase())

// helpful/reaction 팝오버 — uid 만 있으므로 authorMap 으로 이름/이니셜 해석(폴백 익명).
function nameFor(uid: number): string {
  return props.authorMap?.get(uid)?.displayName ?? '알 수 없는 사용자'
}
function initialFor(uid: number): string {
  return (props.authorMap?.get(uid)?.displayName || '?').charAt(0).toUpperCase()
}

const emit = defineEmits<{
  reply: [parentId: number, body: string, quote: QuoteInfo | null]
  edit: [commentId: number, body: string]
  delete: [commentId: number]
  helpful: [commentId: number]
  scrollToQuote: [kind: string, sourceId: number | null]
}>()

const showReplyForm = ref(false)
const editing = ref(false)
const showHelpfulTooltip = ref(false)

function quoteLabel(kind: string, sourceId: number | null): string {
  if (kind === 'CASE_BODY') return 'Context'
  if (kind === 'STEP' && sourceId != null) {
    const idx = props.stepIndexMap?.get(sourceId)
    return `Step ${idx != null ? idx + 1 : '?'}`
  }
  return ''
}

function handleReply(body: string, quote: QuoteInfo | null) {
  emit('reply', props.comment.id, body, quote)
  showReplyForm.value = false
}

function handleEdit(body: string) {
  emit('edit', props.comment.id, body)
  editing.value = false
}

const isAuthor = props.comment.isAuthorOfCase
const isDeleted = computed(() => !!props.comment.deletedAt)
const isEdited = computed(() => !!props.comment.editedAt)
const displayDate = computed(() => isEdited.value ? props.comment.editedAt! : props.comment.createdAt)
</script>

<template>
  <div :id="'comment-' + comment.id" class="py-4" :class="{ 'ml-4 border-l border-zinc-200 dark:border-zinc-800 pl-3': (depth ?? 0) > 0 }">
    <div v-if="isDeleted" class="text-xs text-zinc-400 dark:text-zinc-600 italic py-2">
      This comment has been deleted.
    </div>
    <div v-else>
      <div class="flex items-start gap-3">
        <component
          :is="comment.author ? 'router-link' : 'div'"
          :to="comment.author ? { name: 'profile', params: { id: String(comment.author.userId) } } : undefined"
          class="shrink-0 mt-0.5"
          :title="comment.author ? `View ${comment.author.displayName}'s profile` : undefined"
        >
          <img
            v-if="comment.author?.avatarUrl"
            :src="comment.author.avatarUrl"
            :alt="comment.author.displayName"
            class="w-7 h-7 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
          />
          <div v-else class="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
            {{ authorInitial }}
          </div>
        </component>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <router-link
              v-if="comment.author"
              :to="{ name: 'profile', params: { id: String(comment.author.userId) } }"
              class="group/author flex items-center gap-2 min-w-0"
            >
              <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300 group-hover/author:text-emerald-600 dark:group-hover/author:text-emerald-400 transition-colors">{{ comment.author.displayName }}</span>
              <span v-if="comment.author.handle" class="text-[10px] font-mono text-zinc-400 dark:text-zinc-600">@{{ comment.author.handle }}</span>
            </router-link>
            <span v-else class="text-xs font-medium text-zinc-700 dark:text-zinc-300">알 수 없는 사용자</span>
            <span v-if="isAuthor" class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium">Author</span>
            <span class="text-[10px] text-zinc-400 dark:text-zinc-600 cursor-default" :title="formatAbsolute(displayDate)">
              {{ timeAgo(displayDate) }}
              <template v-if="isEdited"> &middot; edited</template>
            </span>
          </div>

          <div
            v-if="comment.quote && comment.quote.kind !== 'NONE' && comment.quote.snapshot"
            class="mb-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-zinc-800/40 border-l-2 border-emerald-400 cursor-pointer hover:bg-emerald-100 dark:hover:bg-zinc-800/60 transition-colors"
            @click="$emit('scrollToQuote', comment.quote.kind, comment.quote.sourceId)"
          >
            <span class="text-[10px] font-medium text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">{{ quoteLabel(comment.quote.kind, comment.quote.sourceId) }}</span>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 italic line-clamp-2">"{{ comment.quote.snapshot }}"</p>
          </div>

          <div v-if="!editing">
            <MarkdownBody :content="comment.body" class="!text-sm !text-zinc-600 dark:!text-zinc-400 !leading-relaxed" />
          </div>
          <div v-else>
            <CommentForm
              :initial-body="comment.body"
              submit-label="Save"
              @submit="(body) => handleEdit(body)"
              @cancel="editing = false"
            />
          </div>

          <div class="flex items-center gap-3 mt-2.5">
            <button class="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors" @click="showReplyForm = !showReplyForm">Reply</button>
            <button class="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors" @click="editing = !editing">Edit</button>
            <button class="text-[11px] text-zinc-400 hover:text-rose-500 transition-colors" @click="$emit('delete', comment.id)">Delete</button>
            <span class="flex-1" />
            <div class="relative flex items-center gap-1.5" @mouseenter="showHelpfulTooltip = true" @mouseleave="showHelpfulTooltip = false">
              <div v-if="comment.helpful.count" class="flex items-center" style="margin-right: 2px;">
                <div
                  v-for="(uid, i) in comment.helpful.userIds.slice(0, 5)"
                  :key="uid"
                  class="w-5 h-5 rounded-full border border-white dark:border-zinc-900 flex items-center justify-center text-[8px] font-medium shrink-0 relative bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                  :style="{ marginLeft: i > 0 ? '-6px' : '0', zIndex: 5 - i }"
                  :title="nameFor(uid)"
                >{{ initialFor(uid) }}</div>
              </div>
              <button
                class="flex items-center gap-1 text-[11px] transition-colors"
                :class="comment.helpful.helpedByMe ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400'"
                @click="$emit('helpful', comment.id)"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg>
                <span v-if="comment.helpful.count" class="font-medium">{{ comment.helpful.count }}</span>
                <span v-else>Helpful</span>
              </button>
              <div
                v-if="showHelpfulTooltip && comment.helpful.count"
                class="absolute bottom-full right-0 mb-2 rounded-lg bg-zinc-800 dark:bg-zinc-700 shadow-lg whitespace-nowrap z-10 overflow-hidden"
              >
                <div class="px-3 py-1.5 border-b border-zinc-700 dark:border-zinc-600">
                  <span class="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">Found helpful</span>
                </div>
                <div class="px-3 py-2 space-y-1.5">
                  <div v-for="uid in comment.helpful.userIds" :key="uid" class="flex items-center gap-2">
                    <div class="w-4 h-4 rounded-full bg-zinc-600 dark:bg-zinc-500 flex items-center justify-center text-[7px] font-medium text-zinc-200 shrink-0">{{ initialFor(uid) }}</div>
                    <span class="text-[11px] text-zinc-200 dark:text-zinc-300">{{ nameFor(uid) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="showReplyForm" class="mt-3">
            <CommentForm
              placeholder="Write a reply..."
              @submit="handleReply"
              @cancel="showReplyForm = false"
            />
          </div>

          <div v-if="comment.replies?.length">
            <CommentItem
              v-for="reply in comment.replies"
              :key="reply.id"
              :comment="reply"
              :case-owner-user-id="caseOwnerUserId"
              :depth="(depth ?? 0) + 1"
              :step-index-map="stepIndexMap"
              :author-map="authorMap"
              @reply="(parentId, body, quote) => $emit('reply', parentId, body, quote)"
              @edit="(id, body) => $emit('edit', id, body)"
              @delete="(id) => $emit('delete', id)"
              @helpful="(id) => $emit('helpful', id)"
              @scroll-to-quote="(kind, sourceId) => $emit('scrollToQuote', kind, sourceId)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
