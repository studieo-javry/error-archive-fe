import apiClient from './apiClient'
import type {
  AgentConnection,
  CreateAgentConnectionRequest,
  CreateAgentConnectionResult,
} from '@/types/agentConnection'

// iam /me/agent-connections — 로컬 커넥터(Claude Code MCP) 연결 토큰 발급·조회·폐기. 웹 로그인 세션 전용.
export const agentConnectionApi = {
  /** 내 연결 목록(폐기된 것 제외). 만료된(미폐기) 연결은 expired=true. */
  list() {
    return apiClient.get<AgentConnection[]>('/me/agent-connections')
  },
  /** 토큰 발급(201). 응답 token 은 이 응답에서만 노출(서버는 해시만 저장). */
  create(request: CreateAgentConnectionRequest) {
    return apiClient.post<CreateAgentConnectionResult>('/me/agent-connections', request)
  },
  /** 연결 폐기(204, 멱등). 다음 요청부터 즉시 효력. 이미 수집된 기록은 유지. */
  revoke(connectionId: string) {
    return apiClient.delete<void>(`/me/agent-connections/${connectionId}`)
  },
}

export default agentConnectionApi
