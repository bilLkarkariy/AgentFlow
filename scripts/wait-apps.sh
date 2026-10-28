#!/usr/bin/env bash
#
# Waits until every ArgoCD Application is Synced + Healthy, printing a
# refreshed table each round. Times out after WAIT_TIMEOUT seconds (20 min
# by default) and exits 1 with the offenders listed.
#
set -euo pipefail

CONTEXT="${KUBE_CONTEXT:-kind-agentflow-local}"
ARGOCD_NS="${ARGOCD_NS:-argocd}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-1200}"
POLL_INTERVAL="${POLL_INTERVAL:-15}"
# Applications are only expected once platform-root has rendered them.
MIN_APPS="${MIN_APPS:-1}"

if [[ -t 1 ]]; then
  RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; DIM=$'\033[2m'; RST=$'\033[0m'
else
  RED=''; YEL=''; GRN=''; DIM=''; RST=''
fi

kube() { kubectl --context "$CONTEXT" "$@"; }

if ! kube version >/dev/null 2>&1; then
  echo "wait-apps: cannot reach context '${CONTEXT}'." >&2
  echo "  kind export kubeconfig --name agentflow-local" >&2
  exit 1
fi

JSONPATH='{range .items[*]}{.metadata.name}{"\t"}{.metadata.annotations.argocd\.argoproj\.io/sync-wave}{"\t"}{.status.sync.status}{"\t"}{.status.health.status}{"\n"}{end}'

colourise() {
  # stdin: name<TAB>wave<TAB>sync<TAB>health
  local name wave sync health colour
  while IFS=$'\t' read -r name wave sync health; do
    [[ -n "$name" ]] || continue
    sync="${sync:-Unknown}"
    health="${health:-Unknown}"
    wave="${wave:-0}"
    if [[ "$sync" == "Synced" && "$health" == "Healthy" ]]; then
      colour="$GRN"
    elif [[ "$health" == "Degraded" || "$health" == "Missing" ]]; then
      colour="$RED"
    else
      colour="$YEL"
    fi
    printf '  %s%-28s%s %s%4s%s  %-12s %s%s%s\n' \
      "$colour" "$name" "$RST" "$DIM" "$wave" "$RST" "$sync" "$colour" "$health" "$RST"
  done
}

deadline=$(( $(date +%s) + WAIT_TIMEOUT ))
round=0

while :; do
  round=$((round + 1))
  raw="$(kube -n "$ARGOCD_NS" get applications.argoproj.io -o jsonpath="$JSONPATH" 2>/dev/null || true)"
  # Sort by wave (numeric), then by name.
  sorted="$(printf '%s' "$raw" | awk -F'\t' 'NF{printf "%s\n", $0}' | sort -t$'\t' -k2,2n -k1,1)"

  total="$(printf '%s' "$sorted" | grep -c . || true)"
  ready="$(printf '%s' "$sorted" | awk -F'\t' '$3=="Synced" && $4=="Healthy"' | grep -c . || true)"

  now="$(date +%H:%M:%S)"
  printf '\n%s[%s] round %d - %s/%s Applications Synced+Healthy%s\n' \
    "$DIM" "$now" "$round" "$ready" "$total" "$RST"
  printf '  %-28s %4s  %-12s %s\n' "NAME" "WAVE" "SYNC" "HEALTH"
  printf '%s' "$sorted" | colourise

  if [[ "$total" -ge "$MIN_APPS" && "$total" -gt 0 && "$ready" -eq "$total" ]]; then
    printf '\n%sAll %s Applications are Synced and Healthy.%s\n' "$GRN" "$total" "$RST"
    exit 0
  fi

  if [[ "$(date +%s)" -ge "$deadline" ]]; then
    printf '\n%sTimed out after %ss.%s Still not ready:\n' "$RED" "$WAIT_TIMEOUT" "$RST"
    printf '%s' "$sorted" | awk -F'\t' '!($3=="Synced" && $4=="Healthy")' | colourise
    printf '\nInspect one with:\n  kubectl -n %s describe application <name>\n' "$ARGOCD_NS"
    exit 1
  fi

  sleep "$POLL_INTERVAL"
done
