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
  curl -ksfL -o /dev/null "$url" && break
  sleep 2
done

# The bare address redirects to a language; the headers of both answers are checked.
answer=$(curl -ksfiL "$url")
expect() { grep -qiF "$1" <<<"$answer" || { echo "MISSING: $1" >&2; exit 1; }; }
expect '>Zirbe</a></h3>'
expect 'strict-transport-security: max-age=31536000'
expect 'x-content-type-options: nosniff'
expect "content-security-policy: frame-ancestors 'none'"
expect 'referrer-policy: same-origin'
expect 'permissions-policy: camera=(), microphone=(), geolocation=()'
expect 'x-robots-tag: noindex, nofollow'

# Text comes compressed, in Brotli for the list Chrome sends and in gzip where only that is accepted;
# a picture comes as it is.
headers() { curl -ksfL -o /dev/null -D - -H "Accept-Encoding: ${2:-gzip, deflate, br, zstd}" "$url$1"; }
# The language home page itself, so the redirect before it answers for nothing.
home=$(curl -ksfL -o /dev/null -w "%{url_effective}" "$url")
script=$(grep -oE "main-[A-Za-z0-9_-]+\\.js" <<<"$answer" | head -1)
picture=$(grep -oE "/pictures/[^\" ]+\\.webp" <<<"$answer" | head -1)
# The demo's largest map tile, which the proxy compresses by its type.
tile=$(cd content/demo && ls -S map/tiles/*/15/*/*.mvt | head -1)
for path in "${home#"$url"}" "/$script" "/$tile"; do
  answer=$(headers "$path")
  expect "content-encoding: br"
  grep -qiE "^vary:.*accept-encoding" <<<"$answer" || { echo "MISSING: vary accept-encoding on $path" >&2; exit 1; }
  answer=$(headers "$path" gzip)
  expect "content-encoding: gzip"
done
answer=$(headers "$picture")
! grep -qi "content-encoding:" <<<"$answer" || { echo "COMPRESSED: $picture" >&2; exit 1; }
# Only the simulator's checkout page is routed to it, with the site's headers; its API is not.
answer=$(curl -ksi "$url/simulated-checkout/cs_test_none")
expect 'There is no such payment.'
expect 'x-robots-tag: noindex, nofollow'
[ "$(curl -ks -o /dev/null -w "%{http_code}" "$url/v1/checkout/sessions")" = 404 ] || { echo "PUBLIC: the simulator's API" >&2; exit 1; }
echo "OK: the stack serves the apartments with its headers, text compressed, and the checkout page"
