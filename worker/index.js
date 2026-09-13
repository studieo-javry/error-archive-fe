/**
 * apex(error-archive.com) 엣지 Worker.
 *
 * 발행 공개 페이지 `/p/*` 는 SPA 라우트가 아니라 publish-api 가 HTML 을 직접 렌더한다
 * (크롤러용 canonical/OG 포함). Cloudflare Static Assets 의 SPA 폴백에 맡기면
 * 정적 파일이 없는 `/p/{slug}` 는 index.html(빈 SPA 셸)로 200 응답 → 라우트가 없어 빈 화면.
 *
 * 그래서 `/p/*` 만 게이트웨이(→ publish-api)로 리버스 프록시하고,
 * 나머지 모든 경로는 정적 자산(ASSETS)에 위임한다 — not_found_handling: SPA 폴백 그대로.
 * wrangler `assets.run_worker_first = ["/p/*"]` 라 이 Worker 는 `/p/*` 에서만 실행된다.
 */
const GATEWAY_ORIGIN = 'https://api.error-archive.com'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/p' || url.pathname.startsWith('/p/')) {
      const upstream = new URL(url.pathname + url.search, GATEWAY_ORIGIN)
      return fetch(new Request(upstream, request))
    }
    return env.ASSETS.fetch(request)
  },
}
