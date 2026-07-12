<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronDownIcon, PlusIcon, ArrowRightOnRectangleIcon } from '@heroicons/vue/24/outline'
import { useTeamStore, PUBLIC_SLUG } from '@/stores/teamStore'
import { teamApi } from '@/services/teamApi'
import Modal from '@/components/common/Modal.vue'

const teamStore = useTeamStore()
const router = useRouter()
const open = ref(false)

const showCreate = ref(false)
const showJoin = ref(false)
const newName = ref('')
const newSlug = ref('')
const slugTouched = ref(false)
const createError = ref('')
const joinToken = ref('')
const creating = ref(false)
const joining = ref(false)

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

// Mirror iam-api validation: name = ASCII letters/digits/space/hyphen (1-50);
// slug = kebab-case (lowercase alnum, single hyphens, no leading/trailing/double), 2-40.
const nameValid = computed(() => {
  const n = newName.value.trim()
  return n.length >= 1 && n.length <= 50 && /^[A-Za-z0-9 -]+$/.test(n)
})
const slugValid = computed(() =>
  newSlug.value.length >= 2 && newSlug.value.length <= 40 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(newSlug.value),
)
// Auto-derive the slug from the name until the user edits it manually.
watch(newName, (name) => {
  if (!slugTouched.value) newSlug.value = slugify(name)
})

onMounted(() => {
  if (!teamStore.workspaces.length) teamStore.fetchWorkspaces()
})

// Navigate to the workspace's Library; the router guard sets the current workspace from the slug.
function goWorkspace(slug: string) {
  open.value = false
  router.push({ name: 'errorList', params: { slug } })
}

function openCreate() {
  open.value = false
  newName.value = ''
  newSlug.value = ''
  slugTouched.value = false
  createError.value = ''
  showCreate.value = true
}

function openJoin() {
  open.value = false
  showJoin.value = true
}

async function createWorkspace() {
  if (!nameValid.value || !slugValid.value) return
  creating.value = true
  createError.value = ''
  try {
    // iam-api takes only { name, slug }; the response (WorkspaceResponse) carries the slug.
    const { data } = await teamApi.createWorkspace({ name: newName.value.trim(), slug: newSlug.value })
    await teamStore.fetchWorkspaces()
    showCreate.value = false
    router.push({ name: 'errorList', params: { slug: data.slug } })
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status
    createError.value =
      status === 409 ? 'That slug is already taken. Try another.'
      : status === 400 ? 'Check the name and slug format.'
      : 'Could not create the workspace. Please try again.'
  } finally {
    creating.value = false
  }
}

async function joinWorkspace() {
  const token = joinToken.value.trim()
  if (!token) return
  joining.value = true
  try {
    await teamApi.acceptInvitation(token)
    await teamStore.fetchWorkspaces()
    joinToken.value = ''
    showJoin.value = false
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="truncate max-w-[140px]">{{ teamStore.currentWorkspace?.name ?? 'Public' }}</span>
      <ChevronDownIcon class="w-4 h-4 text-zinc-400 shrink-0" />
    </button>

    <div v-if="open" class="fixed inset-0 z-40" @click="open = false" />

    <div
      v-if="open"
      role="menu"
      class="absolute top-10 left-0 w-56 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg z-50 py-1.5"
    >
      <button
        type="button"
        role="menuitem"
        class="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
        :class="teamStore.currentWorkspaceId === null
          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
          : 'text-zinc-700 dark:text-zinc-300'"
        @click="goWorkspace(PUBLIC_SLUG)"
      >
        Public
      </button>
      <button
        v-for="ws in teamStore.workspaces"
        :key="ws.workspaceId"
        type="button"
        role="menuitem"
        class="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
        :class="teamStore.currentWorkspaceId === ws.workspaceId
          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
          : 'text-zinc-700 dark:text-zinc-300'"
        @click="goWorkspace(ws.slug)"
      >
        {{ ws.name }}
      </button>

      <div class="border-t border-zinc-100 dark:border-zinc-700 my-1" />

      <button
        type="button"
        role="menuitem"
        class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
        @click="openCreate"
      >
        <PlusIcon class="w-4 h-4 text-zinc-400" />
        Create workspace
      </button>
      <button
        type="button"
        role="menuitem"
        class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
        @click="openJoin"
      >
        <ArrowRightOnRectangleIcon class="w-4 h-4 text-zinc-400" />
        Join workspace
      </button>
    </div>

    <Modal :show="showCreate" title="Create workspace" @close="showCreate = false">
      <div class="space-y-4">
        <div>
          <label class="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">Name</label>
          <input v-model="newName" placeholder="e.g. Frontend Team" class="raw-input w-full text-sm" />
          <p v-if="newName && !nameValid" class="text-[11px] mt-1 text-rose-500">
            Letters, numbers, spaces, and hyphens only (max 50).
          </p>
        </div>
        <div>
          <label class="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">URL slug</label>
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-zinc-400 dark:text-zinc-500 font-mono">/w/</span>
            <input
              v-model="newSlug"
              placeholder="frontend-team"
              class="raw-input flex-1 text-sm font-mono"
              @input="slugTouched = true"
            />
          </div>
          <p class="text-[11px] mt-1" :class="newSlug && !slugValid ? 'text-rose-500' : 'text-zinc-400 dark:text-zinc-500'">
            Lowercase letters, numbers, and single hyphens (2–40). Fixed after creation.
          </p>
        </div>
        <p v-if="createError" class="text-[11px] text-rose-500">{{ createError }}</p>
        <button
          class="w-full px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          :disabled="creating || !nameValid || !slugValid"
          @click="createWorkspace"
        >
          {{ creating ? 'Creating...' : 'Create' }}
        </button>
      </div>
    </Modal>

    <Modal :show="showJoin" title="Join workspace" @close="showJoin = false">
      <div class="space-y-4">
        <input v-model="joinToken" placeholder="Paste invitation link or token" class="raw-input w-full text-sm" @keyup.enter="joinWorkspace" />
        <button
          class="w-full px-4 py-2 text-sm font-medium rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          :disabled="joining || !joinToken.trim()"
          @click="joinWorkspace"
        >
          {{ joining ? 'Joining...' : 'Join' }}
        </button>
      </div>
    </Modal>
  </div>
</template>
