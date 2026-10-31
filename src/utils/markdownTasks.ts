// Markdown 작업 목록(`- [ ] 할 일` / `- [x] 한 일`) 줄 판별과 N번째 항목 체크 변경.
// MarkdownBody 와 같은 규칙으로 센다 — ``` 코드 블록 안의 줄은 작업 목록이 아니다.

/** 한 줄(앞뒤 공백 제거 후)이 작업 목록 항목인지. [1] = 체크 문자, [2] = 내용 */
export const TASK_LINE = /^-\s+\[( |x|X)\]\s+(.+)$/

const FENCE = /```(\w*)\n([\s\S]*?)```/g

/** 코드 블록 밖 구간마다 fn(구간) 을 적용해 다시 이어 붙인다. */
function mapOutsideFences(src: string, fn: (text: string) => string): string {
  let out = ''
  let last = 0
  for (const m of src.matchAll(FENCE)) {
    out += fn(src.slice(last, m.index)) + m[0]
    last = m.index + m[0].length
  }
  return out + fn(src.slice(last))
}

/**
 * index 번째(0부터, 코드 블록 밖 작업 항목 순서) 항목의 체크 상태를 checked 로 바꾼 원문.
 * 그런 항목이 없으면 null.
 */
export function setTaskChecked(src: string, index: number, checked: boolean): string | null {
  let n = 0
  let found = false
  const next = mapOutsideFences(src, text => text.split('\n').map(line => {
    if (!TASK_LINE.test(line.trim())) return line
    if (n++ !== index) return line
    found = true
    return line.replace(/\[( |x|X)\]/, checked ? '[x]' : '[ ]')
  }).join('\n'))
  return found ? next : null
}
