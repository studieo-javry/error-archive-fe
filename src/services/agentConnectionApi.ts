import apiClient from './apiClient'
import type {
  AgentConnection,
  ConnectorVersionResult,
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
  /**
   * 설치 안내용 — 로컬 커넥터 npm 패키지의 최신 배포 버전. 설치 명령은 @latest 라 이 값에 의존하지 않고(표시·고정용),
   * 커넥터 버전업 시 FE 재배포가 필요 없다. 비공개 패키지라 BE 가 읽기권한 토큰으로 조회·캐싱해 반환한다.
   * latest=null 이면 조회 실패(토큰 없음·네트워크 등).
   *
   * NOTE: 패키지를 public 으로 전환하면 이 BE 조회를 제거하고 FE 가 npm Registry 를 직접 조회해도 된다
   *   (예: GET https://registry.npmjs.org/@error-archive/agent 의 dist-tags.latest).
   */
  connectorVersion() {
    return apiClient.get<ConnectorVersionResult>('/me/agent-connections/connector-version')
  },
}

export default agentConnectionApi
