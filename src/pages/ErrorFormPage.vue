<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { errorApi } from '@/services/errorApi'
import { snippetApi } from '@/services/snippetApi'
import { attachmentApi } from '@/services/attachmentApi'
import { teamApi } from '@/services/teamApi'
import { useTeamStore } from '@/stores/teamStore'
import { useAuthStore } from '@/stores/authStore'
import { useDemoStore } from '@/stores/demoStore'
import type { Visibility, SnippetCreateRequest, SnippetCreateResponse, AttachmentUploadResponse, ErrorCaseSnippet, ErrorCaseAttachment, MyPendingAttachment, MyPendingSnippet } from '@/types/error'
import type { WorkspaceListItem } from '@/types/team'
import BodyRenderer from '@/components/common/BodyRenderer.vue'
import SnippetModal from '@/components/snippet/SnippetModal.vue'
import SnippetCard from '@/components/snippet/SnippetCard.vue'
import AttachmentModal from '@/components/attachment/AttachmentModal.vue'
import AttachmentCard from '@/components/attachment/AttachmentCard.vue'
import DemoNotice from '@/components/demo/DemoNotice.vue'
import { CodeBracketIcon, PaperClipIcon, ClockIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const teamStore = useTeamStore()
const authStore = useAuthStore()
const demo = useDemoStore()
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
  // 게스트(데모)는 입력만 체험 — 저장하지 않고 가입 전환 다이얼로그로 안내한다.
  if (authStore.isGuest) {
    demo.openDialog('signup')
    return
  }
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

// ── 미연결(pending) 자료 복원 (새 케이스 작성 시만) ──
// /mine 은 케이스에 아직 연결 안 한 내 업로드 전부(=여러 초안 것이 섞일 수 있음)를 돌려준다.
// 새로고침·이탈 후에도 서버에 24h 남아있어, 여기서 다시 불러와 이어붙일 수 있게 한다.
const pendingAttachments = ref<MyPendingAttachment[]>([])
const pendingSnippets = ref<MyPendingSnippet[]>([])
const pendingDismissed = ref(false)
const pendingTipOpen = ref(false)
const pendingTotal = computed(() => pendingAttachments.value.length + pendingSnippets.value.length)
const showPending = computed(() => !isEdit && !pendingDismissed.value && pendingTotal.value > 0)

async function loadPending() {
  if (isEdit) return
  const [a, s] = await Promise.allSettled([attachmentApi.listMine(), snippetApi.listMine()])
  if (a.status === 'fulfilled') pendingAttachments.value = a.value.data
  if (s.status === 'fulfilled') pendingSnippets.value = s.value.data
}

function restoreAttachment(p: MyPendingAttachment) {
  // AttachmentCard 는 markerId 로 썸네일을 직접 받아오므로 storageUrl 은 비워도 된다.
  attachmentMarkers.value.push({
    markerId: p.markerId, embedToken: p.embedToken, fileName: p.fileName,
    contentType: p.contentType, size: p.size, kind: p.kind, storageUrl: '',
  })
  pendingAttachments.value = pendingAttachments.value.filter(x => x.markerId !== p.markerId)
}
function restoreSnippet(p: MyPendingSnippet) {
  snippetMarkers.value.push({
    markerId: p.markerId, embedToken: p.embedToken, title: p.title,
    language: p.language, caption: p.caption, code: p.code,
  })
  pendingSnippets.value = pendingSnippets.value.filter(x => x.markerId !== p.markerId)
}
async function discardAttachment(p: MyPendingAttachment) {
  pendingAttachments.value = pendingAttachments.value.filter(x => x.markerId !== p.markerId)
  await attachmentApi.delete(p.markerId).catch(() => {})
}
async function discardSnippet(p: MyPendingSnippet) {
  pendingSnippets.value = pendingSnippets.value.filter(x => x.markerId !== p.markerId)
  await snippetApi.delete(p.markerId).catch(() => {})
}
function restoreAllPending() {
  pendingAttachments.value.slice().forEach(restoreAttachment)
  pendingSnippets.value.slice().forEach(restoreSnippet)
}
function discardAllPending() {
  const atts = pendingAttachments.value.slice()
  const snips = pendingSnippets.value.slice()
  pendingAttachments.value = []
  pendingSnippets.value = []
  atts.forEach(p => attachmentApi.delete(p.markerId).catch(() => {}))
  snips.forEach(p => snippetApi.delete(p.markerId).catch(() => {}))
}

onMounted(async () => {
  await loadError()
  loadPending()
})
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <h1 class="text-2xl font-light serif-title text-zinc-800 dark:text-zinc-100 mb-10">
      {{ isEdit ? 'Edit Error' : 'New Entry' }}
    </h1>

    <DemoNotice v-if="authStore.isGuest" class="mb-8">
      <b>데모 미리보기</b> — 입력은 해볼 수 있지만 저장되지 않아요. 가입하면 내 워크스페이스에 실제로 기록됩니다.
    </DemoNotice>

    <!-- 미연결(pending) 자료 안내 배너 — 새 케이스 작성 시만 -->
    <div
      v-if="showPending"
      class="flex items-center gap-2.5 rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-3.5 py-2.5 mb-8"
    >
      <ClockIcon class="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span class="flex-1 text-[13px] text-zinc-700 dark:text-zinc-200">
        최근 올렸지만 아직 연결 안 한 자료 <b class="font-semibold">{{ pendingTotal }}개</b>가 있어요<span
          class="help-wrap"
          :class="{ open: pendingTipOpen }"
          @click.stop="pendingTipOpen = !pendingTipOpen"
        >
          <button type="button" class="help-btn" aria-label="자세히">?</button>
          <span class="help-tip">
            <b>이 케이스 전용이 아니에요.</b> 케이스에 연결 안 한 내 최근 업로드 전부를 보여줘요(다른 초안 것도 섞일 수 있음). 필요한 것만 골라 붙이면 되고, 그냥 두면 <b>24시간 뒤 자동 정리</b>돼요.
          </span>
        </span>
      </span>
      <div class="flex shrink-0 gap-3">
        <button type="button" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline" @click="restoreAllPending">모두 복원</button>
        <button type="button" class="text-xs font-semibold text-zinc-400 hover:text-rose-500 transition-colors" @click="discardAllPending">모두 지우기</button>
      </div>
    </div>

    <!-- 게스트는 저장하지 않으므로 필수값 검사 없이 바로 가입 안내로 -->
    <form class="space-y-10" :novalidate="authStore.isGuest" @submit.prevent="onSubmit">
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

    <div v-if="showPending || snippetMarkers.length || attachmentMarkers.length" class="mt-10 space-y-2">
      <h3 class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Snippets & Attachments</h3>

      <!-- 연결 안 한 자료: 카드별 개별 복원/지우기 -->
      <template v-if="showPending">
        <p class="pt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">연결 안 한 자료 {{ pendingTotal }}개</p>
        <div
          v-for="p in pendingSnippets"
          :key="'ps-' + p.markerId"
          class="flex items-center gap-3 rounded-xl border border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/60 dark:bg-amber-900/15 px-3 py-2.5"
        >
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
            <CodeBracketIcon class="h-4 w-4" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-200">{{ p.title || '코드 스니펫' }}</p>
            <p class="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{{ p.language }}</p>
          </div>
          <div class="flex shrink-0 gap-2.5">
            <button type="button" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline" @click="restoreSnippet(p)">복원</button>
            <button type="button" class="text-xs text-zinc-400 hover:text-rose-500 transition-colors" @click="discardSnippet(p)">지우기</button>
          </div>
        </div>
        <div
          v-for="p in pendingAttachments"
          :key="'pa-' + p.markerId"
          class="flex items-center gap-3 rounded-xl border border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/60 dark:bg-amber-900/15 px-3 py-2.5"
        >
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
            <PaperClipIcon class="h-4 w-4" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-200">{{ p.title || p.fileName }}</p>
            <p class="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{{ (p.size / 1024).toFixed(1) }}KB</p>
          </div>
          <div class="flex shrink-0 gap-2.5">
            <button type="button" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline" @click="restoreAttachment(p)">복원</button>
            <button type="button" class="text-xs text-zinc-400 hover:text-rose-500 transition-colors" @click="discardAttachment(p)">지우기</button>
          </div>
        </div>
      </template>

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

<style scoped>
/* pending 안내 배너의 "?" 도움말 툴팁 (아래로 드롭) */
.help-wrap {
  position: relative;
  display: inline-flex;
  vertical-align: middle;
  margin-left: 4px;
}
.help-btn {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1px solid #a1a1aa;
  color: #71717a;
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: transparent;
  padding: 0;
  transition: color 0.13s, border-color 0.13s;
}
.help-btn:hover { border-color: #71717a; color: #52525b; }
.help-tip {
  position: absolute;
  top: calc(100% + 9px);
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  width: 250px;
  background: #fff;
  color: #3f3f46;
  border: 1px solid #e4e4e7;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  padding: 11px 13px;
  font-size: 11.5px;
  line-height: 1.55;
  font-weight: 400;
  opacity: 0;
  visibility: hidden;
  transition: all 0.16s;
  z-index: 30;
  text-align: left;
}
.help-tip::after {
  content: "";
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-bottom-color: #fff;
}
.help-tip b { font-weight: 600; color: #18181b; }
.help-wrap:hover .help-tip,
.help-wrap.open .help-tip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}
:global(.dark) .help-btn { border-color: #52525b; color: #a1a1aa; }
:global(.dark) .help-btn:hover { border-color: #a1a1aa; color: #d4d4d8; }
:global(.dark) .help-tip { background: #1f1f23; color: #d4d4d8; border-color: #3f3f46; }
:global(.dark) .help-tip::after { border-bottom-color: #1f1f23; }
:global(.dark) .help-tip b { color: #f4f4f5; }
</style>
