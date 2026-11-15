<script setup lang="ts">
/**
 * 상황 본문(bodyMarkdown) 렌더러 — 본문의 @snippet(clientSnippetId)·@attach(clientArtifactId) 마커를
 * 이 Capture 의 snippets·artifacts 로 해소해 코드블록/첨부칩을 인라인으로 끼워 그린다. 텍스트는 MarkdownBody.
 * (검토 전 단계라 첨부 이미지의 실제 미리보기는 없음 — 파일 메타 칩으로 표시. 반영 후 Case 에서 실제 렌더.)
 */
import { computed } from 'vue'
import CapIcon from '@/components/capture/CapIcon.vue'
import MarkdownBody from '@/components/common/MarkdownBody.vue'
import type { CaptureArtifact, CaptureSnippet } from '@/types/capture'

const props = defineProps<{
  body: string
  snippets?: CaptureSnippet[] | null
  artifacts?: CaptureArtifact[] | null
}>()

interface TextSeg { kind: 'text'; text: string }
interface SnippetSeg { kind: 'snippet'; snippet: CaptureSnippet }
interface AttachSeg { kind: 'attach'; artifact: CaptureArtifact | null; id: string }
type Seg = TextSeg | SnippetSeg | AttachSeg

const MARKER = /@(snippet|attach)\(([A-Za-z0-9_-]+)\)/g

const segments = computed<Seg[]>(() => {
  const snippetById = new Map((props.snippets ?? []).map((s) => [s.clientSnippetId, s]))
  const artifactById = new Map((props.artifacts ?? []).map((a) => [a.clientArtifactId, a]))
  const out: Seg[] = []
  let last = 0
  const body = props.body ?? ''
  for (const m of body.matchAll(MARKER)) {
    const [raw, kind, id] = m
    const start = m.index ?? 0
    const text = body.slice(last, start)
    if (text.trim()) out.push({ kind: 'text', text })
    if (kind === 'snippet') {
      const snip = snippetById.get(id)
      // 해소 안 되면 마커를 텍스트로 보존(사라지지 않게).
      if (snip) out.push({ kind: 'snippet', snippet: snip })
      else out.push({ kind: 'text', text: raw })
    } else {
      out.push({ kind: 'attach', artifact: artifactById.get(id) ?? null, id })
    }
    last = start + raw.length
  }
  const tail = body.slice(last)
  if (tail.trim()) out.push({ kind: 'text', text: tail })
  return out
})

function sizeKb(bytes: number): string {
  return (bytes / 1024).toFixed(0)
}
</script>

<template>
  <div class="cap-body">
    <template v-for="(seg, i) in segments" :key="i">
      <MarkdownBody v-if="seg.kind === 'text'" :content="seg.text" />

      <figure v-else-if="seg.kind === 'snippet'" class="cap-snip">
        <figcaption class="cap-snip-head">
          <span class="cap-snip-title">{{ seg.snippet.title || seg.snippet.filePathOrClass || '코드' }}</span>
          <span class="cap-snip-lang">{{ seg.snippet.language || 'text' }}</span>
        </figcaption>
        <pre class="cap-snip-code"><code>{{ seg.snippet.code }}</code></pre>
        <figcaption v-if="seg.snippet.caption" class="cap-snip-cap">{{ seg.snippet.caption }}</figcaption>
      </figure>

      <div v-else class="cap-attach">
        <CapIcon :name="seg.artifact && seg.artifact.contentType.startsWith('image') ? 'image' : 'file'" />
        <div class="grow">
          <div class="cap-attach-name">{{ seg.artifact?.fileName || seg.id }}</div>
          <div v-if="seg.artifact" class="cap-attach-meta">
            {{ sizeKb(seg.artifact.sizeBytes) }} KB · {{ seg.artifact.contentType }} · 미리보기는 반영 후 Case에서
          </div>
          <div v-else class="cap-attach-meta">첨부를 찾을 수 없어요({{ seg.id }}).</div>
        </div>
      </div>
    </template>
  </div>
</template>
