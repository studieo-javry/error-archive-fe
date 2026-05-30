<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { errorApi } from '@/services/errorApi'
import { snippetApi } from '@/services/snippetApi'
import { attachmentApi } from '@/services/attachmentApi'
import type { Visibility, Snippet, Attachment, SnippetLanguage, SnippetCreateRequest } from '@/types/error'
import SnippetModal from '@/components/snippet/SnippetModal.vue'
import SnippetCard from '@/components/snippet/SnippetCard.vue'
import AttachmentModal from '@/components/attachment/AttachmentModal.vue'
import AttachmentCard from '@/components/attachment/AttachmentCard.vue'
import { CodeBracketIcon, PaperClipIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const isEdit = !!route.params.id
const errorId = route.params.id as string | undefined

const title = ref('')
const errorMessage = ref('')
const context = ref('')
const stackTrace = ref('')
const visibility = ref<Visibility>('PRIVATE')
const tagsInput = ref('')

const snippets = ref<Snippet[]>([])
const attachments = ref<Attachment[]>([])
const showSnippetModal = ref(false)
const showAttachmentModal = ref(false)

const pendingSnippets = ref<{ tempId: string; data: SnippetCreateRequest }[]>([])
const pendingAttachments = ref<{ tempId: string; data: { title?: string; caption?: string; file: File } }[]>([])

const contextRef = ref<HTMLTextAreaElement | null>(null)

function generateTempId() {
  return 'tmp-' + Math.random().toString(16).slice(2, 10)
}

function insertAtCursor(marker: string) {
  const el = contextRef.value
  if (!el) {
    context.value += `\n${marker}`
    return
  }
  const start = el.selectionStart
  const end = el.selectionEnd
  const before = context.value.slice(0, start)
  const after = context.value.slice(end)
  context.value = before + marker + after
  nextTick(() => {
    el.selectionStart = el.selectionEnd = start + marker.length
    el.focus()
  })
}

async function loadError() {
  if (!isEdit || !errorId) return
  const { data } = await errorApi.get(errorId)
  const err = data.data
  title.value = err.title
  errorMessage.value = err.errorMessage
  context.value = err.context
  stackTrace.value = err.stackTrace ?? ''
  visibility.value = err.visibility
  tagsInput.value = err.tags.map((t) => t.name).join(', ')
}

async function loadSnippetsAndAttachments() {
  if (!errorId) return
  const [snpRes, attRes] = await Promise.all([
    snippetApi.list(errorId),
    attachmentApi.list(errorId),
  ])
  snippets.value = snpRes.data.data
  attachments.value = attRes.data.data
}

async function persistPendingItems(createdErrorId: string) {
  const idMap: Record<string, string> = {}

  for (const pending of pendingSnippets.value) {
    const res = await snippetApi.create(createdErrorId, pending.data)
    idMap[pending.tempId] = res.data.data.id
  }

  for (const pending of pendingAttachments.value) {
    const res = await attachmentApi.upload(createdErrorId, pending.data)
    idMap[pending.tempId] = res.data.data.id
  }

  if (Object.keys(idMap).length > 0) {
    let updatedContext = context.value
    for (const [tempId, realId] of Object.entries(idMap)) {
      updatedContext = updatedContext.replaceAll(tempId, realId)
    }
    if (updatedContext !== context.value) {
      await errorApi.update(createdErrorId, { context: updatedContext })
    }
  }
}

async function onSubmit() {
  const tags = tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean)
  if (isEdit && errorId) {
    await errorApi.update(errorId, { title: title.value, errorMessage: errorMessage.value, context: context.value, stackTrace: stackTrace.value || undefined, visibility: visibility.value, tags })
    router.push({ name: 'errorDetail', params: { id: errorId } })
  } else {
    const { data } = await errorApi.create({ title: title.value, errorMessage: errorMessage.value, context: context.value, stackTrace: stackTrace.value || undefined, visibility: visibility.value, tags })
    const createdId = data.data.id
    await persistPendingItems(createdId)
    router.push({ name: 'errorDetail', params: { id: createdId } })
  }
}

async function saveSnippet(data: { title?: string; language: SnippetLanguage; filePath?: string; lineRange?: string; caption?: string; code: string }) {
  if (isEdit && errorId) {
    const res = await snippetApi.create(errorId, data)
    snippets.value.push(res.data.data)
  } else {
    const tempId = generateTempId()
    pendingSnippets.value.push({ tempId, data })
    snippets.value.push({
      id: tempId,
      errorCaseId: '',
      title: data.title,
      language: data.language,
      filePath: data.filePath,
      lineRange: data.lineRange,
      caption: data.caption,
      code: data.code,
      authorId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
  showSnippetModal.value = false
}

async function deleteSnippet(id: string) {
  if (isEdit && errorId) {
    await snippetApi.delete(errorId, id)
  } else {
    pendingSnippets.value = pendingSnippets.value.filter(p => p.tempId !== id)
  }
  snippets.value = snippets.value.filter(s => s.id !== id)
}

async function saveAttachment(data: { title?: string; caption?: string; file: File }) {
  if (isEdit && errorId) {
    const res = await attachmentApi.upload(errorId, data)
    attachments.value.push(res.data.data)
  } else {
    const tempId = generateTempId()
    pendingAttachments.value.push({ tempId, data })
    attachments.value.push({
      id: tempId,
      errorCaseId: '',
      title: data.title,
      fileName: data.file.name,
      mimeType: data.file.type,
      fileSize: data.file.size,
      url: URL.createObjectURL(data.file),
      caption: data.caption,
      kind: data.file.type.startsWith('image/') ? 'image' : 'file',
      authorId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
  showAttachmentModal.value = false
}

async function deleteAttachment(id: string) {
  if (isEdit && errorId) {
    await attachmentApi.delete(errorId, id)
  } else {
    pendingAttachments.value = pendingAttachments.value.filter(p => p.tempId !== id)
  }
  attachments.value = attachments.value.filter(a => a.id !== id)
}

onMounted(async () => {
  await loadError()
  if (isEdit) await loadSnippetsAndAttachments()
})
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100 mb-6">
      {{ isEdit ? 'Edit Error' : 'New Entry' }}
    </h1>

    <form class="space-y-5" @submit.prevent="onSubmit">
      <div>
        <input v-model="title" type="text" placeholder="Error title" class="raw-input w-full text-lg font-medium" required />
      </div>
      <div>
        <input v-model="errorMessage" type="text" placeholder="Error message" class="raw-input w-full text-sm" required />
      </div>
      <div>
        <div class="flex items-center gap-2 mb-1">
          <label class="text-xs text-zinc-500 dark:text-zinc-400">Context</label>
          <div class="flex items-center gap-1 ml-auto">
            <button type="button" class="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors" @click="showSnippetModal = true">
              <CodeBracketIcon class="w-3.5 h-3.5" />
              Code Snippet
            </button>
            <button type="button" class="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors" @click="showAttachmentModal = true">
              <PaperClipIcon class="w-3.5 h-3.5" />
              Attachment
            </button>
          </div>
        </div>
        <textarea ref="contextRef" v-model="context" placeholder="Context — what were you doing?" rows="5" class="raw-textarea w-full" />
      </div>
      <div>
        <textarea v-model="stackTrace" placeholder="Stack trace (optional)" rows="4" class="raw-textarea w-full font-mono text-xs" />
      </div>
      <div>
        <input v-model="tagsInput" type="text" placeholder="Tags (comma separated)" class="raw-input w-full text-sm" />
      </div>
      <div>
        <label class="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Visibility</label>
        <select v-model="visibility" class="raw-input text-sm">
          <option value="PRIVATE">Private</option>
          <option value="WORKSPACE">Workspace</option>
          <option value="LINK_ONLY">Link Only</option>
          <option value="DISCOVERABLE">Discoverable</option>
        </select>
      </div>

      <div class="flex gap-3 pt-4">
        <button type="submit" class="px-6 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
          {{ isEdit ? 'Update' : 'Create' }}
        </button>
        <button type="button" class="px-6 py-2 text-sm font-medium rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 transition-colors" @click="router.back()">
          Cancel
        </button>
      </div>
    </form>

    <!-- Snippet/Attachment cards (outside form to prevent validation tooltips) -->
    <div v-if="snippets.length || attachments.length" class="mt-6 space-y-2">
      <h3 class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Snippets & Attachments</h3>
      <SnippetCard
        v-for="snp in snippets"
        :key="snp.id"
        :snippet="snp"
        @insert="insertAtCursor"
        @delete="deleteSnippet"
        @edit="() => {}"
      />
      <AttachmentCard
        v-for="att in attachments"
        :key="att.id"
        :attachment="att"
        @insert="insertAtCursor"
        @delete="deleteAttachment"
        @edit="() => {}"
      />
    </div>

    <SnippetModal v-if="showSnippetModal" @save="saveSnippet" @close="showSnippetModal = false" />
    <AttachmentModal v-if="showAttachmentModal" @save="saveAttachment" @close="showAttachmentModal = false" />
  </div>
</template>
