#!/usr/bin/env bash
#
# Adds (or refreshes) the single /etc/hosts line that makes
# *.127.0.0.1.sslip.io resolve to 127.0.0.1, where the kind cluster forwards
# host port 80/443 to the Istio ingress gateway.
#
# Idempotent: the line is tagged with "# agentflow" and replaced in place.
# Needs sudo once. `--remove` deletes the line again.
#
set -euo pipefail

DOMAIN="${DOMAIN:-127.0.0.1.sslip.io}"
HOSTS_FILE="${HOSTS_FILE:-/etc/hosts}"
MARKER="# agentflow"
SERVICES=(api studio dashboard rabbitmq grafana argocd kiali rollouts prometheus alertmanager)

usage() {
  cat <<EOF
Usage: $(basename "$0") [--remove] [--dry-run]

  --remove   drop the "$MARKER" line from $HOSTS_FILE
  --dry-run  print what would change, touch nothing

Environment: DOMAIN (default: 127.0.0.1.sslip.io), HOSTS_FILE (default: /etc/hosts)
EOF
}

remove=false
dry_run=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --remove) remove=true ;;
    --dry-run) dry_run=true ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'unknown argument: %s\n\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

line="127.0.0.1"
for svc in "${SERVICES[@]}"; do
  line+=" ${svc}.${DOMAIN}"
done
line+=" ${MARKER}"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

# Everything except our own managed line.
grep -v -F "$MARKER" "$HOSTS_FILE" > "$tmp" || true

if [[ "$remove" == false ]]; then
  printf '%s\n' "$line" >> "$tmp"
fi

if diff -q "$HOSTS_FILE" "$tmp" >/dev/null 2>&1; then
  echo "hosts: already up to date (${HOSTS_FILE})"
  exit 0
fi

echo "hosts: change to ${HOSTS_FILE}"
diff -u "$HOSTS_FILE" "$tmp" || true

if [[ "$dry_run" == true ]]; then
  echo "hosts: --dry-run, nothing written"
  exit 0
fi

if [[ -w "$HOSTS_FILE" ]]; then
  cat "$tmp" > "$HOSTS_FILE"
else
  echo "hosts: writing ${HOSTS_FILE} needs sudo"
  sudo cp "$tmp" "$HOSTS_FILE"
  sudo chmod 644 "$HOSTS_FILE"
fi

echo "hosts: done"
