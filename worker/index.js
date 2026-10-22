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
 *
 * 프레이밍: publish-api 는 `X-Frame-Options: DENY` 를 붙여 모든 iframe 임베드를 막는다(클릭재킹 방어).
 * 게스트 가이드에서 발행물을 **새 탭 대신 앱 안(iframe)** 에서 보여주려면 같은 출처(apex) 프레이밍만
 * 허용해야 한다. 그래서 `/p/*` 응답에서 XFO 를 떼고 `CSP: frame-ancestors 'self'` 로 바꾼다
 * — 외부 사이트의 프레이밍은 여전히 차단되고, 우리 앱(동일 출처)만 임베드할 수 있다.
 */
const GATEWAY_ORIGIN = 'https://api.error-archive.com'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/p' || url.pathname.startsWith('/p/')) {
      const upstream = new URL(url.pathname + url.search, GATEWAY_ORIGIN)
      const res = await fetch(new Request(upstream, request))
      const headers = new Headers(res.headers)
      // DENY 는 same-origin 프레이밍까지 막으므로 제거하고, frame-ancestors 로 same-origin 만 허용.
      headers.delete('X-Frame-Options')
      const existingCsp = headers.get('Content-Security-Policy')
      headers.set(
        'Content-Security-Policy',
        existingCsp && !/frame-ancestors/i.test(existingCsp)
          ? `${existingCsp}; frame-ancestors 'self'`
          : "frame-ancestors 'self'",
      )
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
    }
    return env.ASSETS.fetch(request)
  },
}
