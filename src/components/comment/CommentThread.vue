<script setup lang="ts">
import { ref } from 'vue'
import type { Comment } from '@/services/commentApi'
import CommentForm from './CommentForm.vue'

defineProps<{ comments: Comment[] }>()
const emit = defineEmits<{ reply: [parentId: string, content: string]; delete: [id: string] }>()

const replyingTo = ref<string | null>(null)

function handleReply(parentId: string, content: string) {
  emit('reply', parentId, content)
  replyingTo.value = null
}
</script>

<template>
  <div class="space-y-4">
    <div v-for="comment in comments" :key="comment.id" class="group">
      <div v-if="!comment.isDeleted" class="flex gap-3">
        <img :src="comment.author.avatarUrl" :alt="comment.author.displayName" class="w-6 h-6 rounded-full mt-0.5" />
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300">{{ comment.author.displayName }}</span>
            <span class="text-[10px] text-zinc-400">{{ new Date(comment.createdAt).toLocaleDateString() }}</span>
          </div>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">{{ comment.content }}</p>
          <div class="flex gap-3 mt-1">
            <button class="text-[10px] text-zinc-400 hover:text-indigo-500" @click="replyingTo = comment.id">Reply</button>
            <button class="text-[10px] text-zinc-400 hover:text-rose-500 opacity-0 group-hover:opacity-100" @click="emit('delete', comment.id)">Delete</button>
          </div>
          <div v-if="replyingTo === comment.id" class="mt-2">
            <CommentForm @submit="handleReply(comment.id, $event)" />
          </div>
          <div v-if="comment.replies?.length" class="mt-3 ml-4 border-l border-zinc-200 dark:border-zinc-700 pl-4">
            <CommentThread :comments="comment.replies" @reply="(parentId: string, content: string) => emit('reply', parentId, content)" @delete="(id: string) => emit('delete', id)" />
          </div>
        </div>
      </div>
      <div v-else class="text-xs text-zinc-400 italic pl-9">This comment has been deleted</div>
    </div>
  </div>
</template>
