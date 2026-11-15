// 오프라인 데모(VITE_OFFLINE_MODE) 전용 플로팅 시나리오 스위처.
// 네 디자인 목업의 상단 proto 바와 같은 역할 — MSW 핸들러가 읽는 localStorage 시나리오를 바꾼다.
// 바닐라 DOM 으로 body 에 직접 주입(실제 Vue 앱/소스와 분리).
import type { DemoScenario } from './captureData'

const SCENARIOS: { value: DemoScenario; label: string }[] = [
  { value: 'normal', label: '기본 시나리오' },
  { value: 'first', label: '첫 방문 · 연결 없음' },
  { value: 'empty', label: '검토 대기 없음' },
  { value: 'error', label: '목록 조회 실패' },
  { value: 'loading', label: '목록 불러오는 중' },
  { value: 'revision', label: '반영 시 revision 충돌' },
  { value: 'duplicate', label: '다른 탭에서 이미 반영' },
  { value: 'network', label: '반영 응답 유실' },
  { value: 'notfound', label: '상세 접근 불가' },
  { value: 'restoreOpen', label: '미봉인 기록 복원' },
]

export function mountDemoPanel() {
  if (document.getElementById('cap-demo-panel')) return
  const current = localStorage.getItem('cap-demo-scenario') || 'normal'

  const bar = document.createElement('div')
  bar.id = 'cap-demo-panel'
  bar.style.cssText = [
    'position:fixed', 'left:50%', 'transform:translateX(-50%)', 'bottom:16px', 'z-index:2147483647',
    'display:flex', 'align-items:center', 'gap:10px', 'padding:7px 12px', 'border-radius:999px',
    'background:#18181b', 'color:#e4e4e7', 'box-shadow:0 10px 40px #0006', 'font:500 12px Inter,system-ui,sans-serif',
  ].join(';')

  const brand = document.createElement('span')
  brand.textContent = 'OFFLINE DEMO'
  brand.style.cssText = 'font-size:10px;letter-spacing:.12em;color:#71717a'

  const select = document.createElement('select')
  select.setAttribute('aria-label', '테스트 시나리오')
  select.style.cssText = 'background:#2a2a30;color:#e4e4e7;border:1px solid #45454d;border-radius:7px;padding:4px 8px;font:inherit'
  for (const s of SCENARIOS) {
    const opt = document.createElement('option')
    opt.value = s.value
    opt.textContent = s.label
    if (s.value === current) opt.selected = true
    select.appendChild(opt)
  }
  select.addEventListener('change', () => {
    localStorage.setItem('cap-demo-scenario', select.value)
    location.reload()
  })

  const reset = document.createElement('button')
  reset.textContent = '초기화'
  reset.style.cssText = 'background:transparent;color:inherit;border:1px solid #45454d;border-radius:7px;padding:4px 10px;font:inherit;cursor:pointer'
  reset.addEventListener('click', () => {
    localStorage.setItem('cap-demo-scenario', 'normal')
    location.reload()
  })

  bar.append(brand, select, reset)
  document.body.appendChild(bar)
}
