// GFM 파이프 표 파싱 — 커스텀 마크다운 렌더러(MarkdownBody)용.
//
// 입력 라인들은 MarkdownBody 에서 **이미 escape·인라인(코드/볼드/링크) 처리된** 상태로 들어온다.
// 따라서 셀 내용은 그대로 HTML 로 넣는다(재이스케이프 금지). 셀 구분은 `|`, 리터럴 파이프는 `\|`.

/** 한 행을 셀 배열로. 선행/후행 `|` 제거 후 `\|` 는 리터럴로 복원하며 `|` 로 분리, 각 셀 trim. */
export function splitCells(row: string): string[] {
  const s = row.trim().replace(/^\|/, '').replace(/\|\s*$/, '')
  const cells: string[] = []
  let cur = ''
  for (let k = 0; k < s.length; k++) {
    if (s[k] === '\\' && s[k + 1] === '|') { cur += '|'; k++; continue }
    if (s[k] === '|') { cells.push(cur.trim()); cur = ''; continue }
    cur += s[k]
  }
  cells.push(cur.trim())
  return cells
}

/** 구분행인가 — `---`·`:--`·`--:`·`:-:` 셀들(파이프 구분, 양끝 파이프 선택). 대시 1개 이상 필수. */
export function isDelimiterRow(line: string): boolean {
  return line.includes('-') && /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(line.trim())
}

/** 정렬 — `:--`=left, `--:`=right, `:-:`=center, 그 외 미지정. */
export function alignOf(spec: string): '' | 'left' | 'right' | 'center' {
  const t = spec.trim(); const l = t.startsWith(':'); const r = t.endsWith(':')
  return l && r ? 'center' : r ? 'right' : l ? 'left' : ''
}

/** lines[i] 가 표의 헤더행인가 — 파이프를 포함하고 바로 다음 줄이 구분행. */
export function isTableStart(lines: string[], i: number): boolean {
  return lines[i].includes('|') && i + 1 < lines.length && isDelimiterRow(lines[i + 1])
}

/**
 * lines[start]=헤더, lines[start+1]=구분행(호출자가 isTableStart 로 확인)인 지점부터 표를 만든다.
 * 이어지는 셀 행들(빈 줄이나 파이프 없는 줄 전까지)을 본문으로 소비한다.
 * @returns html 과 마지막으로 소비한 줄 인덱스(end). 바깥 루프는 `i = end` 후 진행하면 된다.
 */
export function buildTable(lines: string[], start: number): { html: string; end: number } {
  const aligns = splitCells(lines[start + 1]).map(alignOf)
  const headers = splitCells(lines[start])
  const attr = (i: number) => (aligns[i] ? ` style="text-align:${aligns[i]}"` : '')
  const thead = `<tr>${headers.map((c, i) => `<th${attr(i)}>${c}</th>`).join('')}</tr>`
  const body: string[] = []
  let j = start + 2
  for (; j < lines.length; j++) {
    const r = lines[j].trim()
    if (!r || !r.includes('|')) break
    const cells = splitCells(r)
    body.push(`<tr>${headers.map((_h, i) => `<td${attr(i)}>${cells[i] ?? ''}</td>`).join('')}</tr>`)
  }
  return {
    html: `<div class="md-table-wrap"><table><thead>${thead}</thead><tbody>${body.join('')}</tbody></table></div>`,
    end: j - 1,
  }
}
