# 정적 SPA 서빙 이미지. CI 가 만든 dist/ 를 그대로 담는다(이미지 안에서 빌드하지 않음).
# RUN 단계가 없어 amd64 러너에서도 QEMU 없이 linux/arm64 이미지를 만들 수 있다.
# unprivileged 이미지: non-root(101) 로 8080 에서 listen.
FROM nginxinc/nginx-unprivileged:1.30-alpine

COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/
