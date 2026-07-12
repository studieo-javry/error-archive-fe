<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { errorApi } from '@/services/errorApi'
import { snippetApi } from '@/services/snippetApi'
import { attachmentApi } from '@/services/attachmentApi'
import { teamApi } from '@/services/teamApi'
import { useTeamStore } from '@/stores/teamStore'
import type { Visibility, SnippetCreateRequest, SnippetCreateResponse, AttachmentUploadResponse, ErrorCaseSnippet, ErrorCaseAttachment } from '@/types/error'
import type { WorkspaceListItem } from '@/types/team'
import BodyRenderer from '@/components/common/BodyRenderer.vue'
import SnippetModal from '@/components/snippet/SnippetModal.vue'
import SnippetCard from '@/components/snippet/SnippetCard.vue'
import AttachmentModal from '@/components/attachment/AttachmentModal.vue'
import AttachmentCard from '@/components/attachment/AttachmentCard.vue'
import { CodeBracketIcon, PaperClipIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const teamStore = useTeamStore()
const isEdit = !!route.params.id
const caseId = route.params.id ? Number(route.params.id) : undefined

const title = ref('')
const scope = ref('')
const paste = ref('')
const description = ref('')
const visibility = ref<Visibility>('PRIVATE')
const tags = ref<string[]>([])
const tagInput = ref('')
const workspaces = ref<WorkspaceListItem[]>([])
const workspaceId = ref<number | null>(null)

watch(visibility, async (val) => {
  if (val === 'WORKSPACE' && !workspaces.value.length) {
    const res = await teamApi.listWorkspaces()
    workspaces.value = res.data
  }
})

function addTag(e: Event) {
  e.preventDefault()
  const val = tagInput.value.trim()
  if (val && !tags.value.includes(val)) {
    tags.value.push(val)
  }
  tagInput.value = ''
}

function removeTag(tag: string) {
  tags.value = tags.value.filter(t => t !== tag)
}

const snippetMarkers = ref<SnippetCreateResponse[]>([])
const attachmentMarkers = ref<AttachmentUploadResponse[]>([])
const showSnippetModal = ref(false)
const showAttachmentModal = ref(false)

const descriptionRef = ref<HTMLTextAreaElement | null>(null)
const previewMode = ref(false)

// Adapt the form's in-progress markers to the shapes BodyRenderer expects.
const previewSnippets = computed<ErrorCaseSnippet[]>(() =>
  snippetMarkers.value.map(s => ({
    markerId: s.markerId,
    title: s.title ?? '',
    language: s.language,
    filePathOrClass: null,
    lineRange: null,
    caption: s.caption ?? null,
    code: s.code ?? '',
  })),
)
const previewAttachments = computed<ErrorCaseAttachment[]>(() =>
  attachmentMarkers.value.map(a => ({
    markerId: a.markerId,
    fileName: a.fileName,
    contentType: a.contentType,
    size: a.size,
    kind: a.kind,
    storageUrl: a.storageUrl,
    title: null,
    caption: null,
  })),
)

// Drag-resize in the preview rewrites the image marker's width: @attach(id|width).
function onImageResize(markerId: string, width: number) {
  const re = new RegExp(`@attach\\(${markerId}(?:\\|\\d+)?\\)`, 'g')
  description.value = description.value.replace(re, `@attach(${markerId}|${width})`)
}

function insertAtCursor(marker: string) {
  const el = descriptionRef.value
  if (!el) {
    description.value += `\n${marker}`
    return
  }
  const start = el.selectionStart
  const end = el.selectionEnd
  const before = description.value.slice(0, start)
  const after = description.value.slice(end)
  description.value = before + marker + after
  nextTick(() => {
    el.selectionStart = el.selectionEnd = start + marker.length
    el.focus()
  })
}

async function loadError() {
  if (!isEdit || !caseId) return
  const { data } = await errorApi.get(caseId)
  title.value = data.title
  scope.value = data.project ?? ''
  paste.value = data.snapshot?.rawPaste ?? ''
  description.value = data.description ?? ''
  visibility.value = data.visibility as Visibility
  tags.value = data.tags ?? []
  if (data.workspaceId) {
    workspaceId.value = data.workspaceId
    const wsRes = await teamApi.listWorkspaces()
    workspaces.value = wsRes.data
  }

  snippetMarkers.value = data.snippets.map(s => ({
    markerId: s.markerId,
    embedToken: '',
    title: s.title,
    language: s.language,
    caption: s.caption,
    code: s.code,
  }))
  attachmentMarkers.value = data.attachments.map(a => ({
    markerId: a.markerId,
    embedToken: '',
    fileName: a.fileName,
    contentType: a.contentType,
    size: a.size,
    kind: a.kind,
    storageUrl: a.storageUrl,
  }))
}

async function onSubmit() {
  const snippetMarkerIds = snippetMarkers.value.map(s => s.markerId)
  const attachmentMarkerIds = attachmentMarkers.value.map(a => a.markerId)

  const wsId = visibility.value === 'WORKSPACE' ? workspaceId.value : null

  if (isEdit && caseId) {
    await errorApi.update(caseId, {
      title: title.value,
      project: scope.value || null,
      paste: paste.value || null,
      description: description.value || null,
      visibility: visibility.value,
      snippetMarkerIds,
      attachmentMarkerIds,
      tags: tags.value,
    })
    router.push({ name: 'errorDetail', params: { slug: teamStore.currentSlug, id: caseId } })
  } else {
    const { data } = await errorApi.create({
      title: title.value,
      project: scope.value || undefined,
      paste: paste.value || '',
      description: description.value || undefined,
      visibility: visibility.value,
      workspaceId: wsId ?? undefined,
      snippetMarkerIds,
      attachmentMarkerIds,
      tags: tags.value.length ? tags.value : undefined,
    })
    router.push({ name: 'errorDetail', params: { slug: teamStore.currentSlug, id: data.id } })
  }
}

async function saveSnippet(data: SnippetCreateRequest) {
  const res = await snippetApi.create(data)
  // Keep the just-entered code locally so the card can preview it (create response omits code).
  snippetMarkers.value.push({ ...res.data, code: data.code })
  showSnippetModal.value = false
}

async function deleteSnippet(markerId: string) {
  await snippetApi.delete(markerId)
  snippetMarkers.value = snippetMarkers.value.filter(s => s.markerId !== markerId)
}

async function saveAttachment(data: { title?: string; caption?: string; file: File }) {
  const res = await attachmentApi.upload(data)
  attachmentMarkers.value.push(res.data)
  showAttachmentModal.value = false
}

async function deleteAttachment(markerId: string) {
  await attachmentApi.delete(markerId)
  attachmentMarkers.value = attachmentMarkers.value.filter(a => a.markerId !== markerId)
}

onMounted(loadError)
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100 mb-10">
      {{ isEdit ? 'Edit Error' : 'New Entry' }}
    </h1>

    <form class="space-y-10" @submit.prevent="onSubmit">
      <div>
        <input v-model="title" type="text" placeholder="Error title" class="raw-input w-full text-lg font-medium" required />
      </div>
      <div>
        <input v-model="scope" type="text" placeholder="Project (optional)" class="raw-input w-full text-sm" />
      </div>
      <div class="group">
        <label class="text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:group-focus-within:text-white block mb-3">Tags</label>
        <div class="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 min-h-[38px]">
          <span
            v-for="tag in tags"
            :key="tag"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs"
          >
            {{ tag }}
            <button type="button" class="hover:text-emerald-900 dark:hover:text-emerald-100" @click="removeTag(tag)">&times;</button>
          </span>
          <input
            v-model="tagInput"
            type="text"
            placeholder="Add tag and press Enter"
            class="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
            @keydown.enter="addTag"
          />
        </div>
      </div>
      <div class="group">
        <label class="text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:group-focus-within:text-white block mb-3">Error Trace <span class="text-zinc-400 dark:text-zinc-600">(optional)</span></label>
        <textarea v-model="paste" placeholder="Paste error output / stack trace" rows="4" class="raw-textarea w-full font-mono text-xs" />
      </div>
      <div class="group">
        <label class="text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:group-focus-within:text-white block mb-3">Description</label>
        <div class="flex items-center gap-4 mb-2">
          <div class="flex items-center gap-4 text-xs">
            <button type="button" class="relative pb-0.5 transition-colors" :class="!previewMode ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'" @click="previewMode = false">
              Write
              <span v-if="!previewMode" class="absolute left-0 right-0 -bottom-px h-px bg-emerald-500" />
            </button>
            <button type="button" class="relative pb-0.5 transition-colors" :class="previewMode ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'" @click="previewMode = true">
              Preview
              <span v-if="previewMode" class="absolute left-0 right-0 -bottom-px h-px bg-emerald-500" />
            </button>
          </div>
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
        <textarea v-show="!previewMode" ref="descriptionRef" v-model="description" placeholder="Description — additional context" rows="5" class="raw-textarea w-full" />
        <div v-show="previewMode" class="min-h-[7rem] border-l-2 border-zinc-200 dark:border-zinc-700 pl-4">
          <BodyRenderer
            v-if="previewMode && description.trim()"
            :content="description"
            :snippets="previewSnippets"
            :attachments="previewAttachments"
            editable
            @resize="onImageResize"
          />
          <p v-else class="text-sm text-zinc-400 dark:text-zinc-500">Nothing to preview yet — write a description or insert a snippet/attachment.</p>
          <p v-if="previewMode && description.trim()" class="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">Tip: drag the handle on an image's right edge to resize it.</p>
        </div>
      </div>
      <div class="group">
        <label class="text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:group-focus-within:text-white block mb-3">Visibility</label>
        <select v-model="visibility" class="raw-input text-sm">
          <option value="PRIVATE">Private</option>
          <option value="WORKSPACE">Workspace</option>
          <option value="PUBLIC">Public</option>
        </select>
      </div>
      <div v-if="visibility === 'WORKSPACE'" class="group">
        <label class="text-sm font-medium text-zinc-500 dark:text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:group-focus-within:text-white block mb-3">Workspace</label>
        <select v-model="workspaceId" class="raw-input text-sm" required>
          <option :value="null" disabled>Select workspace</option>
          <option v-for="ws in workspaces" :key="ws.workspaceId" :value="ws.workspaceId">{{ ws.name }}</option>
        </select>
        <p v-if="!workspaces.length" class="text-xs text-zinc-400 mt-1">No workspaces found. Create one first.</p>
      </div>

      <div class="flex gap-3 pt-6">
        <button type="submit" class="px-6 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
          {{ isEdit ? 'Update' : 'Create' }}
        </button>
        <button type="button" class="px-6 py-2 text-sm font-medium rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 transition-colors" @click="router.back()">
          Cancel
        </button>
      </div>
    </form>

    <div v-if="snippetMarkers.length || attachmentMarkers.length" class="mt-10 space-y-2">
      <h3 class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Snippets & Attachments</h3>
      <SnippetCard
        v-for="snp in snippetMarkers"
        :key="snp.markerId"
        :snippet="snp"
        @insert="insertAtCursor"
        @delete="() => deleteSnippet(snp.markerId)"
      />
      <AttachmentCard
        v-for="att in attachmentMarkers"
        :key="att.markerId"
        :attachment="att"
        @insert="insertAtCursor"
        @delete="() => deleteAttachment(att.markerId)"
      />
    </div>

    <SnippetModal v-if="showSnippetModal" @save="saveSnippet" @close="showSnippetModal = false" />
    <AttachmentModal v-if="showAttachmentModal" @save="saveAttachment" @close="showAttachmentModal = false" />
  </div>
</template>
