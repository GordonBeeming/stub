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

# Job control enables a new process group per background job. `pnpm dev`
# (with `&`) then runs as its own PGID, which we capture and kill on
# shutdown. That targets only the vite/node/workerd tree this script
# spawned — never a sibling `pnpm dev` the developer already has running
# for another project.
#
# Workerd is the exception: the Cloudflare Vite plugin spawns it as a
# detached worker that re-parents to init, so it escapes the PGID we
# control. Snapshot workerd PIDs at startup and delta-kill at shutdown so
# we only touch the ones this run brought up.
set -m
SELF_WORKERDS_BEFORE=$( (pgrep -f workerd 2>/dev/null || true) | sort | tr '\n' ' ')

cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "// shutting down"
  # Kill our own process group — hits pnpm, node, vite, and anything else
  # in the tree. The leading `-` on the PID tells kill to address the PGID.
  if [ -n "${DEV_PID:-}" ]; then
    kill -TERM "-${DEV_PID}" 2>/dev/null || true
    # Grace window, then SIGKILL if anything is still alive.
    sleep 1
    kill -KILL "-${DEV_PID}" 2>/dev/null || true
  fi
  # Delta-clean the detached workerd(s) this run spawned — they don't
  # live in our PGID because the plugin daemonises them.
  local after
  after=$(pgrep -f workerd 2>/dev/null || true)
  for pid in $after; do
    case " $SELF_WORKERDS_BEFORE " in
      *" $pid "*) ;;             # pre-existing, leave it alone
      *) kill -9 "$pid" 2>/dev/null || true ;;
    esac
  done
  exit 0
}
# EXIT fires for any exit path, including SIGPIPE from a dead pipeline reader
# (e.g. `./run.sh | grep ...` where grep is killed first).
trap cleanup INT TERM EXIT

pnpm dev &
DEV_PID=$!
wait "$DEV_PID"
