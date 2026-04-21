#!/usr/bin/env bash
# Local dev one-shot. Runs stub on http://localhost:5173 with real Cloudflare bindings (local D1, KV, R2) via Miniflare.
# First run sets up wrangler.toml, .dev.vars, applies the D1 schema. Subsequent runs skip setup and start fast.
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Try: corepack enable" >&2
  exit 1
fi

# Install deps only when the lockfile or node_modules is missing or stale.
if [ ! -d node_modules ] || [ pnpm-lock.yaml -nt node_modules ]; then
  echo "// installing deps"
  pnpm install
fi

cd apps/app

if [ ! -f wrangler.toml ]; then
  echo "// creating wrangler.toml from example"
  cp wrangler.example.toml wrangler.toml
fi

if [ ! -f .dev.vars ]; then
  echo "// creating .dev.vars with throwaway dev secrets (not for production)"
  cat > .dev.vars <<'EOF'
SESSION_SECRET=dev-session-secret-not-for-production-min-32-bytes
RESEND_API_KEY=re_dev_fake
TURNSTILE_SECRET=1x0000000000000000000000000000000AA
IP_HASH_SALT=dev-salt
EOF
fi

if [ ! -d .wrangler/state/v3/d1 ]; then
  echo "// applying D1 migrations to local"
  npx wrangler d1 migrations apply DB --local
fi

echo ""
echo "// starting stub on http://localhost:5173"
echo "// ctrl+c to stop"
echo ""

# Run vite in its own process group. On ctrl+c, nuke the whole group so
# workerd, vite, node and any orphans die together — piping this script
# through grep/tee otherwise leaves workerd holding the miniflare port.
# Snapshot workerd pids at startup so we can kill only the ones we spawned
# (not another stub instance the user might already have running).
# `|| true` — pgrep exits 1 when nothing matches, which under set -e +
# pipefail would kill the script before the server starts.
SELF_WORKERDS_BEFORE=$( (pgrep -f workerd 2>/dev/null || true) | sort | tr '\n' ' ')

cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "// shutting down"
  # Workerd detaches from its spawner (vite → @cloudflare/vite-plugin →
  # node), so by the time we get here it's re-parented to init. Walking
  # the PID tree doesn't reach it. Kill by name, but spare any workerd
  # that was already running before we started. Fall back to anything
  # still holding the vite port.
  local after
  after=$(pgrep -f workerd 2>/dev/null || true)
  for pid in $after; do
    case " $SELF_WORKERDS_BEFORE " in
      *" $pid "*) ;;             # pre-existing, leave it alone
      *) kill -9 "$pid" 2>/dev/null || true ;;
    esac
  done
  pkill -f "vite" 2>/dev/null || true
  pkill -f "wrangler dev" 2>/dev/null || true
  lsof -ti:5173 2>/dev/null | xargs -r kill -9 2>/dev/null || true
  exit 0
}
# EXIT fires for any exit path, including SIGPIPE from a dead pipeline reader
# (e.g. `./run.sh | grep ...` where grep is killed first).
trap cleanup INT TERM EXIT

pnpm dev
wait
