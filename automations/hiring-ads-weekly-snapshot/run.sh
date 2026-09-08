#!/usr/bin/env bash
set -euo pipefail
umask 077

export HOME="/Users/brady"
export CODEX_HOME="/Users/brady/.codex"
export TZ="America/Denver"
export PATH="/Users/brady/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

REPO_DIR="/Users/brady/workspace/sle/marketing/marketing-director-dashboard"
AUTOMATION_HOME="${REPO_DIR}/automations/hiring-ads-weekly-snapshot/runtime"
TSX_BIN="${REPO_DIR}/node_modules/.bin/tsx"

mkdir -p "${AUTOMATION_HOME}/runs" "${AUTOMATION_HOME}/logs"
chmod 700 "${AUTOMATION_HOME}" "${AUTOMATION_HOME}/runs" "${AUTOMATION_HOME}/logs"

cd "${REPO_DIR}"

# launchd does not inherit interactive shell env, so load the dashboard's local env explicitly.
if [[ -f ".env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.local"
  set +a
fi

if [[ ! -x "${TSX_BIN}" ]]; then
  echo "Missing tsx runner at ${TSX_BIN}" >&2
  exit 1
fi

exec /usr/bin/caffeinate -dimsu -- \
  "${TSX_BIN}" \
  "${REPO_DIR}/scripts/hiring-ads-snapshot.ts" \
  run \
  --automation-home "${AUTOMATION_HOME}" \
  "$@"
