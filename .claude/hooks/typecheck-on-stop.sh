#!/usr/bin/env bash
# Stop hook: run `bun run typecheck` ONLY if this turn touched .ts/.tsx files
# that are still uncommitted. Keeps the green-test checkpoint pattern automatic
# without spamming on conversational turns.
#
# Exit 0 = silent pass (Claude continues normally).
# Exit 2 = non-blocking warning (output is shown to Claude as feedback).
#
# This hook never blocks (never exits 1) — typecheck failures are surfaced as
# warnings so the user can decide whether to act, not as hard stops.

set -uo pipefail

# `cd ""` is a no-op in bash, so the previous `cd "$(...)" || exit 0` silently
# swallowed the not-in-a-git-repo case and ran the rest of the hook in
# whatever directory the user was sitting in. Resolve the repo root
# explicitly and bail when it's empty.
repo_root=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$repo_root" ]; then
  exit 0
fi
cd "$repo_root" || exit 0

# Only check files that are actually modified (staged or unstaged) right now.
# Untracked files we deliberately ignore — those are usually scratch.
changed_ts=$(git diff --name-only --diff-filter=ACMR HEAD 2>/dev/null | grep -E '\.(ts|tsx)$' || true)

if [ -z "$changed_ts" ]; then
  exit 0
fi

# Skip if user explicitly asked us to skip via env var (escape hatch).
if [ "${CLAUDE_SKIP_TYPECHECK:-0}" = "1" ]; then
  exit 0
fi

# Bun is required for typecheck. If it's not on PATH (fresh shell, dotfile
# drift, etc.), surface a clear message rather than letting the user see a
# generic "command not found" mixed with hook plumbing.
if ! command -v bun >/dev/null 2>&1; then
  {
    echo "Stop hook: \`bun\` is not in PATH; skipping typecheck."
    echo "Uncommitted TS files would have been checked:"
    echo "$changed_ts" | sed 's/^/  - /'
    echo "Install Bun (https://bun.sh) or set CLAUDE_SKIP_TYPECHECK=1 to silence."
  } >&2
  exit 0
fi

# Run typecheck quietly. On failure, surface the tail of the output to Claude
# so it can offer to fix.
output=$(bun run typecheck 2>&1)
status=$?

if [ $status -eq 0 ]; then
  exit 0
fi

{
  echo "Typecheck failed after this turn. Uncommitted TS files:"
  echo "$changed_ts" | sed 's/^/  - /'
  echo
  echo "Last 40 lines of \`bun run typecheck\` output:"
  echo "---"
  echo "$output" | tail -40
  echo "---"
  echo "Set CLAUDE_SKIP_TYPECHECK=1 to silence this hook for the session."
} >&2

exit 2
