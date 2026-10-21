import type { ActivityCode, ActivityGrassResponse, GrassDay } from '@/services/insightApi'

/**
 * 게스트(데모)용 샘플 활동 잔디 — 목업 insData() 와 같은 규칙의 결정적(seeded) 1년치 데이터.
 * 갓 만들어진 게스트 계정은 활동 이력이 없어 Insights 가 비어 보이므로, 화면 구성을 보여주기 위해 쓴다.
 * 시드가 고정이라 새로고침해도 같은 모양이고, 끝 날짜만 오늘로 맞춘다.
 */
const TYPES: ActivityCode[] = [
  'CASE_CREATED', 'CASE_RESOLVED', 'CASE_PUBLISHED', 'STEP_ADDED', 'SOLUTION_ADDED',
  'COMMENT_POSTED', 'COMMENT_REACTION', 'COMMENT_HELPFUL', 'FOLLOWED_USER',
]

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function demoActivityGrass(today = new Date()): ActivityGrassResponse {
  let seed = 20260421
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  const days: GrassDay[] = []
  for (let i = 363; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const dow = d.getDay()
    const p = dow === 0 || dow === 6 ? 0.32 : 0.74
    const breakdown: Record<string, number> = {}
    let count = 0
    let score = 0
    // 최근 3일은 항상 활동 — "current streak" 가 0 으로 보이지 않게.
    if (i <= 2 || rnd() < p) {
      const kinds = 1 + Math.floor(rnd() * 3)
      for (let j = 0; j < kinds; j++) {
        const type = TYPES[Math.floor(rnd() * TYPES.length)]
        const n = 1 + Math.floor(rnd() * 4)
        breakdown[type] = (breakdown[type] ?? 0) + n
        count += n
      }
      score = count + Math.floor(rnd() * Math.max(1, count) * 1.6)
    }
    const level = (score === 0 ? 0 : score <= 3 ? 1 : score <= 7 ? 2 : score <= 13 ? 3 : 4) as GrassDay['level']
    days.push({ date: ymd(d), count, score, level, breakdown })
  }

  let longest = 0
  let run = 0
  for (const d of days) {
    if (d.count > 0) { run++; longest = Math.max(longest, run) } else run = 0
  }
  let current = 0
  for (let i = days.length - 1; i >= 0 && days[i].count > 0; i--) current++

  let bestDay: ActivityGrassResponse['bestDay'] = null
  for (const d of days) {
    if (d.score > 0 && (!bestDay || d.score > bestDay.score)) bestDay = { date: d.date, score: d.score }
  }

  return {
    rangeFrom: days[0].date,
    rangeTo: days[days.length - 1].date,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    days,
    streak: { current, longest, currentStartDate: current ? days[days.length - current].date : null },
    totals: {
      events: days.reduce((a, d) => a + d.count, 0),
      score: days.reduce((a, d) => a + d.score, 0),
      activeDays: days.filter(d => d.count > 0).length,
    },
    bestDay,
    thresholds: { mode: 'absolute', l1: 1, l2: 4, l3: 8, l4: 14 },
  }
}
