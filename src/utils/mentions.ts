import type { MentionedUser } from '@/types/error'

// BE(MentionResolver) 와 같은 규칙 — @ 앞이 문자열 시작/공백일 때만 멘션.
const MENTION = /(^|\s)@([A-Za-z0-9_.가-힣-]+)/g
// 표기 뒤에 영숫자가 이어지면 다른 단어(@alicex 는 alice 가 아님). 조사·마침표는 허용.
const WORD_CONT = /[A-Za-z0-9]/
// 코드 안의 @ 는 멘션이 아니다(BE 도 코드 블록을 빼고 파싱). 이미 링크인 곳도 건드리지 않는다.
const SKIP = new Set(['CODE', 'PRE', 'A'])

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 본문 단어(@ 뒤)에 맞는 멘션 — 가장 긴 표기를 고른다(@alice님 → alice). */
function matchUser(word: string, users: MentionedUser[]): MentionedUser | null {
  const w = word.toLowerCase()
  let best: MentionedUser | null = null
  for (const u of users) {
    const id = u.identifier.toLowerCase()
    if (!w.startsWith(id)) continue
    if (WORD_CONT.test(word.charAt(id.length))) continue
    if (!best || id.length > best.identifier.length) best = u
  }
  return best
}

function mentionHtml(u: MentionedUser, viewerId: number | null): string {
  if (u.handle == null) return '<span class="mention-gone">@탈퇴한 사용자</span>'
  const me = viewerId != null && u.userId === viewerId
  return `<a class="mention${me ? ' me' : ''}" href="/profile/${u.userId}"`
    + ` data-mention-uid="${u.userId}" data-name="${escapeHtml(u.displayName)}"`
    + ` data-handle="${escapeHtml(u.handle)}" data-avatar="${escapeHtml(u.avatarUrl ?? '')}"`
    + `>@${escapeHtml(u.displayName)}</a>`
}

/**
 * 렌더된 본문 HTML 의 @표기를 멘션 링크로 바꾼다 — 이름이 확인된 멘션(users)만.
 * 링크 글자는 @표시이름(입력은 @handle 이어도). 표기 뒤 조사는 글자로 남긴다.
 */
export function linkifyMentions(html: string, users: MentionedUser[], viewerId: number | null): string {
  if (!users.length || !html.includes('@')) return html
  const root = document.createElement('template')
  root.innerHTML = html

  const texts: Text[] = []
  const walker = document.createTreeWalker(root.content, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    let skip = false
    for (let p = n.parentElement; p; p = p.parentElement) if (SKIP.has(p.tagName)) { skip = true; break }
    if (!skip && n.nodeValue?.includes('@')) texts.push(n as Text)
  }

  for (const node of texts) {
    const src = node.nodeValue ?? ''
    let out = ''
    let pos = 0
    let changed = false
    for (const m of src.matchAll(MENTION)) {
      const u = matchUser(m[2], users)
      if (!u) continue
      const at = m.index! + m[1].length
      out += escapeHtml(src.slice(pos, at)) + mentionHtml(u, viewerId)
      pos = at + 1 + u.identifier.length
      // 표시이름으로 적은 경우(@Alice Kim → 표기는 Alice) 이름 나머지(" Kim")까지 링크에 포함 — 두 번 보이지 않게.
      const name = u.displayName
      if (name.toLowerCase().startsWith(u.identifier.toLowerCase())) {
        const rest = name.slice(u.identifier.length)
        if (rest && src.slice(pos, pos + rest.length).toLowerCase() === rest.toLowerCase()
          && !WORD_CONT.test(src.charAt(pos + rest.length))) pos += rest.length
      }
      changed = true
    }
    if (!changed) continue
    const span = document.createElement('template')
    span.innerHTML = out + escapeHtml(src.slice(pos))
    node.replaceWith(span.content)
  }
  return root.innerHTML
}
