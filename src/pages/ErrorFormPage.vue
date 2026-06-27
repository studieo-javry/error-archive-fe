<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { errorApi } from '@/services/errorApi'
import { snippetApi } from '@/services/snippetApi'
import { attachmentApi } from '@/services/attachmentApi'
import { teamApi } from '@/services/teamApi'
import { useTeamStore } from '@/stores/teamStore'
import type { Visibility, SnippetCreateRequest, SnippetCreateResponse, AttachmentUploadResponse } from '@/types/error'
import type { WorkspaceListItem } from '@/types/team'
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
  snippetMarkers.value.push(res.data)
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
    <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100 mb-6">
      {{ isEdit ? 'Edit Error' : 'New Entry' }}
    </h1>

    <form class="space-y-5" @submit.prevent="onSubmit">
      <div>
        <input v-model="title" type="text" placeholder="Error title" class="raw-input w-full text-lg font-medium" required />
      </div>
      <div>
        <input v-model="scope" type="text" placeholder="Project (optional)" class="raw-input w-full text-sm" />
      </div>
      <div>
        <label class="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Tags</label>
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
      <div>
        <label class="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Error Trace <span class="text-zinc-400 dark:text-zinc-600">(optional)</span></label>
        <textarea v-model="paste" placeholder="Paste error output / stack trace" rows="4" class="raw-textarea w-full font-mono text-xs" />
      </div>
      <div>
        <div class="flex items-center gap-2 mb-1">
          <label class="text-xs text-zinc-500 dark:text-zinc-400">Description</label>
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
        <textarea ref="descriptionRef" v-model="description" placeholder="Description — additional context" rows="5" class="raw-textarea w-full" />
      </div>
      <div>
        <label class="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Visibility</label>
        <select v-model="visibility" class="raw-input text-sm">
          <option value="PRIVATE">Private</option>
          <option value="WORKSPACE">Workspace</option>
          <option value="PUBLIC">Public</option>
        </select>
      </div>
      <div v-if="visibility === 'WORKSPACE'">
        <label class="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Workspace</label>
        <select v-model="workspaceId" class="raw-input text-sm" required>
          <option :value="null" disabled>Select workspace</option>
          <option v-for="ws in workspaces" :key="ws.workspaceId" :value="ws.workspaceId">{{ ws.name }}</option>
        </select>
        <p v-if="!workspaces.length" class="text-xs text-zinc-400 mt-1">No workspaces found. Create one first.</p>
      </div>

      <div class="flex gap-3 pt-4">
        <button type="submit" class="px-6 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
          {{ isEdit ? 'Update' : 'Create' }}
        </button>
        <button type="button" class="px-6 py-2 text-sm font-medium rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 transition-colors" @click="router.back()">
          Cancel
        </button>
      </div>
    </form>

    <div v-if="snippetMarkers.length || attachmentMarkers.length" class="mt-6 space-y-2">
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
