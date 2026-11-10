#!/usr/bin/env bash
#
# Fails if a tracked file refers to something that only exists outside the
# repository: an absolute path from a developer machine, or the planning
# vocabulary of the sessions that produced the code (work package ids, plan
# sections and annexes). A comment has to make sense with the repository
# alone. See AGENTS.md, "Rules".
#
#   scripts/check-repo-hygiene.sh
#
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# POSIX ERE only (no \b): git grep uses the platform's regex library.
patterns=(
  '/Users/[A-Za-z0-9._-]+/'                      # macOS home directory
  '/home/[a-z][a-z0-9._-]*/\.'                   # dotfiles of a Linux home directory
  '(^|[^A-Za-z0-9])WP[0-9]+([^A-Za-z0-9]|$)'     # work package id
  '(^|[^A-Za-z0-9])this WP([^A-Za-z0-9]|$)'
  '[Pp]lan (section|Annexe) ?[0-9A-Z]'
  'plan §'
  '\(Annexe [A-Z][,)]'
)

status=0
for pattern in "${patterns[@]}"; do
  # The lockfile is excluded: integrity hashes match anything.
  if git grep -nIE -e "$pattern" -- . ':!pnpm-lock.yaml' ':!scripts/check-repo-hygiene.sh'; then
    echo "::error::tracked files match '${pattern}' (see AGENTS.md, Rules)"
    status=1
  fi
done

[ "$status" -eq 0 ] && echo "repo hygiene: ok"
exit "$status"
