#!/usr/bin/env bash
# Deploys one stack to a machine that runs Docker and a Traefik proxy, over SSH as the user
# "deploy": copies compose.yml and the stack's settings to /srv/<STACK_NAME>, starts the images
# the settings name and checks the public address. CI calls it; it runs from a workstation too.
#
#   scripts/deploy.sh <host> <env-file>
#   SSH_OPTS="-i <key>" scripts/deploy.sh ...   for a key that is not in the agent
set -euo pipefail

host=${1:?usage: deploy.sh <host> <env-file>}
env=${2:?usage: deploy.sh <host> <env-file>}
setting() { sed -n "s/^$1=//p" "$env"; }
stack=$(setting STACK_NAME)
domain=$(setting APP_DOMAIN)
web=$(setting WEB_IMAGE)
sim=$(setting SIM_IMAGE)
password=$(setting SITE_PASSWORD)
: "${stack:?STACK_NAME missing in $env}" "${domain:?APP_DOMAIN missing in $env}" "${web:?WEB_IMAGE missing in $env}"
dir=/srv/$stack
# Compose would read quotes, spaces or a # in the settings file otherwise. The value is not shown.
if [[ ! "$password" =~ ^[A-Za-z0-9_-]*$ ]]; then
  echo "SITE_PASSWORD in $env may hold only letters, digits, - and _" >&2
  exit 1
fi

# shellcheck disable=SC2086,SC2029
run() { ssh ${SSH_OPTS:-} "deploy@$host" "$@"; }

# Whatever step fails, the run ends by saying what is on the machine now.
report() {
  [ $? -eq 0 ] && return
  echo "FAILED. On $host now:" >&2
  run "cd $dir && docker compose ps -a --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}' && docker compose logs --tail 20" >&2 || true
}
trap report EXIT

echo "==> Copying the stack to deploy@$host:$dir"
run "cat > $dir/compose.yml" <"$(dirname "$0")/../compose.yml"
# The settings can hold a token, so the file is never readable by others.
run "umask 077 && cat > $dir/.env.new && mv -f $dir/.env.new $dir/.env" <"$env"

# Pulled before anything is restarted: a missing image leaves the running version untouched.
echo "==> Starting $web"
run "cd $dir && docker compose pull -q && docker compose up -d --remove-orphans"

# Only this repository's images, and never the ones just started: the machine is shared.
run "docker images --format '{{.Repository}}:{{.Tag}}' | grep -F '${web%-web:*}-' | grep -vxF -e '$web' -e '$sim' | xargs -r docker rmi" ||
  echo "WARNING: old images were not removed" >&2

# The first request also makes the proxy fetch the certificate, which can take a minute. A site
# with a password must refuse a visitor without it and let one with it in; the password goes to
# curl on stdin, so the process list does not show it.
echo "==> Checking https://$domain"
status() { curl -K - -sL -o /dev/null -w '%{http_code}' --max-time 10 "https://$domain/"; }
checked() {
  if [ -z "$password" ]; then [ "$(status </dev/null)" = 200 ]; return; fi
  [ "$(echo "user = \":$password\"" | status)" = 200 ] &&
    curl -sL -o /dev/null -D - --max-time 10 "https://$domain/" | grep -qi '^www-authenticate: basic'
}
for _ in $(seq 30); do
  if checked; then
    echo "OK: https://$domain serves $web"
    exit 0
  fi
  sleep 5
done

echo "https://$domain did not answer 200${password:+ with its password and 401 without}." >&2
exit 1
