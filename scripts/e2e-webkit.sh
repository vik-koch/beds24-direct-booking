#!/bin/sh
# The e2e suite's WebKit project in the Playwright image CI uses (ADR 9), for a machine whose WebKit
# lacks its system libraries. Run it through `npm run e2e:webkit`, which builds first; arguments go
# to Playwright.
set -e
image=$(grep -o 'mcr.microsoft.com/playwright:v[0-9.]*-[a-z]*' .github/workflows/ci.yml)
# A linked node_modules is mounted at its own path too, so that the link resolves.
modules=$(realpath node_modules)
exec docker run --rm --ipc=host --user "$(id -u):$(id -g)" -e HOME=/tmp -e NPM_CONFIG_UPDATE_NOTIFIER=false \
  -v "$PWD:$PWD" -v "$modules:$modules" -w "$PWD" "$image" \
  npx playwright test --project webkit-phone "$@"
