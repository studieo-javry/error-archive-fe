// iam agent 연결 토큰(/api/v1/me/agent-connections) — AgentConnectionResponses.kt 와 1:1.
// 로컬 커넥터(Claude Code MCP)가 /api/v1/agent/** 호출 시 제시할 opaque 토큰 관리. 웹 로그인 세션 전용.

/** 발급 가능한 scope(wire 값). 생략 시 BE 기본 전체. */
export type AgentScope = 'case:read' | 'capture:read' | 'capture:write' | 'artifact:write'

/** P0 커넥터 기본 발급 범위. */
export const DEFAULT_AGENT_SCOPES: AgentScope[] = ['capture:read', 'capture:write', 'artifact:write', 'case:read']

/** 연결 목록 항목. 토큰 원문은 포함하지 않음. 설치 메타는 커넥터 자기신고(표시용). AgentConnectionResponse. */
export interface AgentConnection {
  connectionId: string
  label?: string | null
  /** 목록 표시명: label → 설치 라벨(hostname) → "{kind} · {cid 앞 8자}". */
  displayName: string
  /** 커넥터 종류(예: claude-code). 신고 전이면 null. */
  clientKind?: string | null
  clientVersion?: string | null
  /** 사람이 읽는 설치 이름(기본 hostname). */
  installLabel?: string | null
  scopes: string[]
  createdAt: string
  lastUsedAt?: string | null
  expiresAt: string
  /** 만료 여부(폐기되진 않았으나 수명이 지난 연결). */
  expired: boolean
}

/** 토큰 발급 요청. CreateAgentConnectionRequest. */
export interface CreateAgentConnectionRequest {
  /** 연결 식별 라벨(예: 로컬 장비·레포 이름). 최대 120자. */
  label?: string | null
  /** 허용 범위. 생략/빈 값이면 BE 기본 전체. */
  scopes?: string[] | null
}

/** 발급 결과. token 은 이 응답에서만 볼 수 있음(서버는 해시만 저장). CreateAgentConnectionResponse. */
export interface CreateAgentConnectionResult {
  connectionId: string
  /** 원문 토큰 — 다시 조회 불가. */
  token: string
  scopes: string[]
  label?: string | null
  createdAt: string
  expiresAt: string
}
