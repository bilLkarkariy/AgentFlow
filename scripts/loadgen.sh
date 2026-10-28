#!/usr/bin/env bash
#
# Background traffic generator for the canary demo.
#
# The Istio success-rate AnalysisRun (deploy/platform/argo-rollouts) divides
# 5xx by total requests per canary revision. With no traffic the query returns
# no series, `or vector(1)` kicks in and the canary is promoted without ever
# having been measured. So the demo needs a steady, boring stream of real
# requests: that is this script.
#
# Default path is `/agents` (a real GET handled by the router), NOT `/health`:
# the chaos middleware deliberately never fails `/health*` or `/metrics`, so
# hammering the health endpoint would produce a 100 % success rate even with
# CHAOS_ERROR_RATE=1 and the rollback demo would silently pass.
#
# `hey` is used when present; otherwise a plain `curl` loop paces itself to
# roughly the same rate so the demo still works on a machine without it.
#
set -euo pipefail

# DOMAIN is exported by the Makefile; 127.0.0.1.sslip.io is the local default
# (public DNS, resolves to 127.0.0.1, no /etc/hosts entry needed).
DOMAIN="${DOMAIN:-127.0.0.1.sslip.io}"
HOST="${LOADGEN_HOST:-api.${DOMAIN}}"
URL="${LOADGEN_URL:-http://127.0.0.1}"
DURATION="${LOADGEN_DURATION:-15m}"
QPS="${LOADGEN_QPS:-20}"
CONCURRENCY="${LOADGEN_CONCURRENCY:-4}"
REQ_PATH="${LOADGEN_PATH:-/agents}"
DRY_RUN=false

usage() {
  cat <<'EOF'
Usage: scripts/loadgen.sh [options]

Sends steady traffic through the Istio ingress gateway so the canary
AnalysisRun has something to measure.

Options:
  --host <name>       Host header, i.e. the VirtualService host
                      (default: api.$DOMAIN, i.e. api.127.0.0.1.sslip.io)
  --url <origin>      Scheme + address actually dialled
                      (default: http://127.0.0.1)
  --duration <dur>    How long to run: 30s, 15m, 1h (default: 15m)
  --qps <n>           Requests per second (default: 20)
  --concurrency <n>   Parallel workers (default: 4)
  --path <path>       Request path (default: /agents)
  --dry-run           Print the command that would run, then exit
  -h, --help          This text

Environment overrides: DOMAIN, LOADGEN_HOST, LOADGEN_URL, LOADGEN_DURATION,
LOADGEN_QPS, LOADGEN_CONCURRENCY, LOADGEN_PATH.

Examples:
  scripts/loadgen.sh                                   # local kind, 15 min
  scripts/loadgen.sh --duration 2m --qps 50            # short burst
  scripts/loadgen.sh --host api.1-2-3-4.sslip.io \
                     --url https://1-2-3-4.sslip.io    # AWS
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)        HOST="${2:?--host needs a value}"; shift 2 ;;
    --url)         URL="${2:?--url needs a value}"; shift 2 ;;
    --duration)    DURATION="${2:?--duration needs a value}"; shift 2 ;;
    --qps)         QPS="${2:?--qps needs a value}"; shift 2 ;;
    --concurrency) CONCURRENCY="${2:?--concurrency needs a value}"; shift 2 ;;
    --path)        REQ_PATH="${2:?--path needs a value}"; shift 2 ;;
    --dry-run)     DRY_RUN=true; shift ;;
    -h|--help)     usage; exit 0 ;;
    *) printf 'loadgen: unknown argument %s\n\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ "$REQ_PATH" == /* ]] || REQ_PATH="/${REQ_PATH}"
URL="${URL%/}"
TARGET="${URL}${REQ_PATH}"

# "15m" / "900s" / "1h" / "900" -> seconds. Used by the curl fallback and by
# the summary line.
to_seconds() {
  local raw="$1" num unit
  num="${raw%[smh]}"
  unit="${raw#"$num"}"
  [[ "$num" =~ ^[0-9]+$ ]] || { echo "loadgen: bad duration '${raw}'" >&2; exit 2; }
  case "$unit" in
    ""|s) printf '%s' "$num" ;;
    m)    printf '%s' "$((num * 60))" ;;
    h)    printf '%s' "$((num * 3600))" ;;
    *)    echo "loadgen: bad duration unit in '${raw}'" >&2; exit 2 ;;
  esac
}

SECONDS_TOTAL="$(to_seconds "$DURATION")"

if command -v hey >/dev/null 2>&1; then
  CMD=(hey -z "$DURATION" -q "$QPS" -c "$CONCURRENCY" -H "Host: ${HOST}" "$TARGET")
else
  CMD=(curl -s -o /dev/null -H "Host: ${HOST}" "$TARGET")
fi

printf 'loadgen: %s  Host: %s  %s req/s x %s workers  for %s (%ss)\n' \
  "$TARGET" "$HOST" "$QPS" "$CONCURRENCY" "$DURATION" "$SECONDS_TOTAL"

if [[ "$DRY_RUN" == true ]]; then
  if command -v hey >/dev/null 2>&1; then
    printf 'loadgen: would run: '
  else
    printf 'loadgen: hey not installed, would run this in a loop: '
  fi
  printf '%q ' "${CMD[@]}"
  printf '\n'
  exit 0
fi

if command -v hey >/dev/null 2>&1; then
  exec "${CMD[@]}"
fi

# ---------------------------------------------------------------------------
# Fallback: no `hey` (brew install hey). One curl per tick, paced with sleep.
# Nowhere near as accurate, but the analysis only needs a request rate that is
# non-zero and roughly constant.
# ---------------------------------------------------------------------------
printf 'loadgen: hey not found (brew install hey), falling back to a curl loop\n'

interval="$(awk -v q="$QPS" 'BEGIN { printf "%.4f", (q > 0 ? 1 / q : 0.05) }')"
deadline=$(( $(date +%s) + SECONDS_TOTAL ))
sent=0
errors=0

trap 'printf "\nloadgen: stopped after %s requests, %s non-2xx\n" "$sent" "$errors"; exit 0' INT TERM

while [[ "$(date +%s)" -lt "$deadline" ]]; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    -H "Host: ${HOST}" "$TARGET" || echo 000)"
  sent=$((sent + 1))
  [[ "$code" == 2* ]] || errors=$((errors + 1))
  if (( sent % 100 == 0 )); then
    printf 'loadgen: %s requests, %s non-2xx\n' "$sent" "$errors"
  fi
  sleep "$interval"
done

printf 'loadgen: done. %s requests, %s non-2xx\n' "$sent" "$errors"
