#!/usr/bin/env bash
# Builds both images, starts the stack behind a throwaway Traefik and checks what it serves.
set -euo pipefail
cd "$(dirname "$0")/.."

compose() { docker compose --env-file .env.example -f compose.yml -f compose.local.yml "$@"; }
finish() {
  [ $? -eq 0 ] || compose logs --tail 40
  compose down
}
trap finish EXIT

docker network inspect traefik >/dev/null 2>&1 || docker network create traefik
compose up -d --build

url=https://localhost:8443
for _ in $(seq 30); do
  curl -ksf -o /dev/null "$url" && break
  sleep 2
done

answer=$(curl -ksfi "$url")
expect() { grep -qiF "$1" <<<"$answer" || { echo "MISSING: $1" >&2; exit 1; }; }
expect '<li>Zirbe</li>'
expect 'strict-transport-security: max-age=31536000'
expect 'x-content-type-options: nosniff'
expect "content-security-policy: frame-ancestors 'none'"
expect 'referrer-policy: same-origin'
expect 'permissions-policy: camera=(), microphone=(), geolocation=()'
expect 'x-robots-tag: noindex, nofollow'
echo "OK: the stack serves the apartments with its headers"
